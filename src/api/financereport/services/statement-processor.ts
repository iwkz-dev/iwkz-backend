import axios from 'axios';

const MONTH_NAMES = [
    'Jan',
    'Feb',
    'M\u00e4rz',
    'Apr',
    'May',
    'Juni',
    'Juli',
    'Aug',
    'Sep',
    'Okt',
    'Nov',
    'Dez',
];
const DEFAULT_PAGE_LIMIT = 1000;
const NOCODB_TIMEOUT_MS = 10000;

const createApplicationError = (message: string, cause?: unknown) => {
    const error = new Error(message) as Error & { cause?: unknown };
    error.cause = cause;
    return error;
};

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const appendQuery = (baseUrl: string, query: string) =>
    `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query}`;

const normalizeForMatch = (value: unknown) =>
    `${value ?? ''}`
        .toLowerCase()
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[|;,/]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const getMonthLabel = (monthNumber: number) =>
    MONTH_NAMES[monthNumber - 1] ?? '';

const getDateParts = (date: string, separator: string) => {
    const [day, month, year] = `${date}`.split(separator);
    return {
        day,
        month,
        monthNumber: Number(month),
        year,
    };
};

const formatAmount = (value: unknown) =>
    Math.abs(Number(value || 0)).toFixed(2);

const createWordBoundaryRegex = (phrase: string) =>
    new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}([^a-z0-9]|$)`, 'i');

const cleanUpDescription = (description: unknown) => {
    const original = `${description ?? ''}`.trim();
    if (!original) return '';

    const cleaned = original
        .replace(/\r\n/g, '\n')
        .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, ' ')
        .replace(/\b[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g, ' ')
        .replace(
            /(von|an)\s+[^\n]+\n(Verwendungszweck|IBAN)/giu,
            (_match, direction, nextLabel) => `${direction} ---\n${nextLabel}`,
        )
        .replace(/[|;]+/g, ' ')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();

    return cleaned || original;
};

const getNocoHeaders = () => {
    const token = process.env.IWKZ_NOCODB_API_TOKEN;
    if (!token) {
        throw createApplicationError(
            'NocoDB configuration is incomplete: missing API token.',
        );
    }

    return {
        accept: 'application/json',
        'xc-token': token,
    };
};

const getLedgerRecordsUrl = () => {
    const tableReference = process.env.IWKZ_NOCODB_TABLE_KEUANGAN_LEDGER;
    const baseUrl = process.env.IWKZ_NOCODB_API;

    if (!tableReference) {
        throw createApplicationError(
            'NocoDB configuration is incomplete: missing ledger table reference.',
        );
    }

    if (/^https?:\/\//i.test(tableReference)) {
        const normalizedReference = stripTrailingSlash(tableReference);

        if (normalizedReference.endsWith('/records')) {
            return normalizedReference;
        }

        if (normalizedReference.includes('/tables/')) {
            return `${normalizedReference}/records`;
        }

        return normalizedReference;
    }

    if (!baseUrl) {
        throw createApplicationError(
            'NocoDB configuration is incomplete: missing API base URL.',
        );
    }

    return `${stripTrailingSlash(baseUrl)}/tables/${tableReference}/records`;
};

const fetchLedgerRows = async (strapi: any) => {
    const recordsUrl = getLedgerRecordsUrl();
    const headers = getNocoHeaders();
    const rows: any[] = [];
    let page = 1;
    let hasNextPage = true;

    strapi.log.info(
        `[statement-processor] Fetching ledger configuration from NocoDB. recordsUrl=${recordsUrl}`,
    );

    while (hasNextPage) {
        try {
            const response = await axios.get(
                appendQuery(
                    recordsUrl,
                    `limit=${DEFAULT_PAGE_LIMIT}&page=${page}&shuffle=0&offset=0`,
                ),
                {
                    headers,
                    timeout: NOCODB_TIMEOUT_MS,
                },
            );
            const payload = response.data ?? {};
            const list = Array.isArray(payload.list) ? payload.list : [];
            const isLastPage = Boolean(payload.pageInfo?.isLastPage);

            rows.push(...list);
            strapi.log.info(
                `[statement-processor] Ledger page fetched. page=${page}, pageSize=${list.length}, totalRows=${rows.length}, isLastPage=${isLastPage}`,
            );
            hasNextPage = list.length > 0 && !isLastPage;
            page += 1;
        } catch (error) {
            strapi.log.error(
                'Failed to fetch finance ledgers from NocoDB.',
                error,
            );
            throw createApplicationError(
                'Failed to fetch finance ledger configuration.',
                error,
            );
        }
    }

    return rows;
};

const parseLedgerDescription = (
    description: unknown,
    strapi?: any,
    ledgerId?: unknown,
) => {
    if (typeof description !== 'string' || !description.trim()) {
        return {};
    }

    try {
        const parsed = JSON.parse(description);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch (error) {
        strapi?.log?.warn(
            `[statement-processor] Invalid JSON in ledger description. ledgerId=${ledgerId}`,
        );
        return {};
    }

    return {};
};

const normalizeLedgerConfigs = (rows: any[], strapi: any) =>
    rows
        .map((row, index) => {
            const ledgerId = Number(row?.ledger_id);
            const category = `${row?.category ?? row?.label ?? ''}`.trim();
            const parsedDescription = parseLedgerDescription(
                row?.description,
                strapi,
                ledgerId,
            );
            const subCategories = Object.entries(parsedDescription)
                .map(([remark, keywords]) => ({
                    remark,
                    keywords: Array.isArray(keywords)
                        ? keywords
                              .map((keyword) => normalizeForMatch(keyword))
                              .filter(Boolean)
                        : [],
                }))
                .filter((entry) => entry.keywords.length > 0);

            if (!Number.isFinite(ledgerId) || !category) {
                strapi.log.warn(
                    `[statement-processor] Skipping invalid ledger config. index=${index}, ledgerId=${row?.ledger_id}, category=${row?.category}, label=${row?.label}`,
                );
                return null;
            }

            return {
                ledgerId,
                category,
                subCategories,
            };
        })
        .filter(Boolean);

const findLedgerInformation = (description: string, ledgerConfigs: any[]) => {
    const normalizedDescription = normalizeForMatch(description);

    for (const ledgerConfig of ledgerConfigs) {
        for (const subCategory of ledgerConfig.subCategories) {
            for (const keyword of subCategory.keywords) {
                if (
                    keyword &&
                    (createWordBoundaryRegex(keyword).test(
                        normalizedDescription,
                    ) ||
                        normalizedDescription.includes(keyword))
                ) {
                    return {
                        ledgerId: ledgerConfig.ledgerId,
                        kategorien: ledgerConfig.category,
                        bemerkung: subCategory.remark,
                        matchedKeyword: keyword,
                    };
                }
            }
        }
    }

    return {
        ledgerId: 0,
        kategorien: '-',
        bemerkung: '-',
        matchedKeyword: '',
    };
};

export const createStatementProcessor = ({ strapi }: { strapi: any }) => ({
    async processStatement(payload: any) {
        strapi.log.info(
            `[statement-processor] Processing statement started. document_date=${payload?.date}, document_type=${payload?.document_type || 'n/a'}, transaction_count=${payload?.data?.length ?? 0}`,
        );
        const ledgerRows = await fetchLedgerRows(strapi);
        const ledgerConfigs = normalizeLedgerConfigs(ledgerRows, strapi);
        const recordedMonths: string[] = [];
        const seenMonths = new Set<string>();
        const prsLedger = ledgerConfigs.find(
            (ledgerConfig) => ledgerConfig.ledgerId === 2253,
        );

        strapi.log.info(
            `[statement-processor] Ledger configuration normalized. rawRows=${ledgerRows.length}, usableConfigs=${ledgerConfigs.length}`,
        );

        const transactions = payload.data.map(
            (transaction: any, index: number) => {
                const amount = Math.abs(Number(transaction.amount) || 0);
                const isIncome = transaction.status === 'income';
                const { month, monthNumber, year } = getDateParts(
                    transaction.date,
                    '-',
                );
                const monthLabel = getMonthLabel(monthNumber);
                const cleanedDescription = cleanUpDescription(
                    transaction.description,
                );
                const ledgerInformation =
                    payload.document_type === 'prs'
                        ? {
                              ledgerId: 2253,
                              kategorien: prsLedger?.category ?? '-',
                              bemerkung: 'PRS',
                              matchedKeyword: 'prs',
                          }
                        : findLedgerInformation(
                              cleanedDescription || transaction.description,
                              ledgerConfigs,
                          );

                if (!ledgerInformation.ledgerId) {
                    strapi.log.warn(
                        `[statement-processor] No ledger match found. index=${index}, date=${transaction.date}, status=${transaction.status}, amount=${amount}, description=${transaction.description}`,
                    );
                } else {
                    strapi.log.info(
                        `[statement-processor] Ledger match found. index=${index}, ledgerId=${ledgerInformation.ledgerId}, kategorien=${ledgerInformation.kategorien}, bemerkung=${ledgerInformation.bemerkung}, keyword=${ledgerInformation.matchedKeyword}`,
                    );
                }

                if (monthLabel && !seenMonths.has(monthLabel)) {
                    seenMonths.add(monthLabel);
                    recordedMonths.push(monthLabel);
                }

                return {
                    steuer: 1,
                    desc: cleanedDescription,
                    kategorien: ledgerInformation.kategorien,
                    sachkonten: ledgerInformation.ledgerId,
                    bemerkung: ledgerInformation.bemerkung,
                    soll: isIncome ? 0 : amount,
                    haben: isIncome ? amount : 0,
                    datum: transaction.date,
                    year,
                    month,
                    lz: monthLabel,
                    einnahme: isIncome ? 'x' : '',
                    ausgabe: isIncome ? '' : 'x',
                };
            },
        );

        const transactionsSaveToDb = transactions.map((transaction: any) => {
            const outcome =
                transaction.ausgabe === 'x'
                    ? formatAmount(transaction.soll)
                    : '0.00';

            const income =
                transaction.einnahme === 'x'
                    ? formatAmount(transaction.haben)
                    : '0.00';
            return {
                year: transaction.year,
                month: Number(transaction.month),
                date: transaction.datum,
                outcome: Number(outcome) < 0 ? `-${outcome}` : outcome,
                income,
                ledger_id: transaction.sachkonten,
            };
        });

        const transactionCashflow = transactions.reduce(
            (acc: Record<string, any>, transaction: any) => {
                const key = `${transaction.year}-${transaction.month}`;
                if (!acc[key]) {
                    acc[key] = {
                        year: transaction.year,
                        month: Number(transaction.month),
                        income: 0,
                        outcome: 0,
                        data_type: payload.document_type || 'unknown',
                    };
                }
                acc[key].income += Number(
                    transaction.einnahme === 'x' ? transaction.haben : 0,
                );
                acc[key].outcome += Number(
                    transaction.ausgabe === 'x' ? transaction.soll : 0,
                );
                return acc;
            },
            {},
        );

        strapi.log.info(
            `[statement-processor] Processing statement finished. recordedMonths=${recordedMonths.join(',')}, transactions=${transactions.length}, transactionsSaveToDb=${transactionsSaveToDb.length}`,
        );

        return {
            document_date: payload.date,
            document_year: getDateParts(payload.date, '.').year,
            recorded_months: recordedMonths,
            transactions,
            transactionsSaveToDb,
            transactionCashflow,
        };
    },
});
