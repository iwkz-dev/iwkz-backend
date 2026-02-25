/**
 * donation-package service
 */

import { factories } from '@strapi/strapi';
import axios from 'axios';
import type { Core } from '@strapi/strapi';
import type {
    CapturePaypalPaymentInput,
    CreateBankTransferDonationInput,
    CreatePaypalPaymentInput,
    DonationPackageEntity,
    DonationPackageItem,
    DonationStats,
    NocoDonationRecord,
    NocoDonationResponse,
    PaymentConfigEntity,
    PaypalAccessTokenResponse,
    PaypalCaptureOrderResponse,
    PaypalOrderResponse,
    PaypalPaymentLinkResponse,
} from '../types/donation-package';

const ZERO_STATS: DonationStats = {
    total_order: 0,
    total_donation: 0,
};

const DONATION_TABLE_ID = process.env.IWKZ_NOCODB_TABLE_DONATIONPACKAGE;
const PAYPAL_BASE_URL =
    process.env.PAYPAL_BASE_URL ?? 'https://api-m.sandbox.paypal.com';
const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY ?? 'EUR';

const generateDonationCaptureId = (): string => {
    return `paypal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
};

const roundToCurrency = (value: number): number => {
    return Math.round(value * 100) / 100;
};

const ceilToCurrency = (value: number): number => {
    return Math.ceil(value * 100) / 100;
};

const buildStatsMap = (
    records: NocoDonationRecord[],
): Map<string, DonationStats> => {
    const statsMap = new Map<string, DonationStats>();

    records.forEach((record) => {
        const donationCode = record.donation_code?.trim();
        if (!donationCode) return;

        const currentStats = statsMap.get(donationCode) ?? ZERO_STATS;
        statsMap.set(donationCode, {
            total_order:
                currentStats.total_order + toNumber(record.total_order),
            total_donation:
                currentStats.total_donation + toNumber(record.total_price),
        });
    });

    return statsMap;
};

const enrichDonationPackages = (
    packages: DonationPackageItem[],
    statsMap: Map<string, DonationStats>,
): DonationPackageItem[] => {
    return packages.map((pkg) => {
        if (!pkg.donationItems || pkg.donationItems.length === 0) {
            return {
                ...pkg,
                donationItems: [],
            };
        }

        const enrichedDonationItems = pkg.donationItems.map((item) => {
            const donationCode = item.uniqueCode ?? '';
            const stats = statsMap.get(donationCode) ?? ZERO_STATS;

            return {
                ...item,
                total_order: stats.total_order,
                total_donation: stats.total_donation,
            };
        });

        return {
            ...pkg,
            donationItems: enrichedDonationItems,
        };
    });
};

const fetchDonationStats = async (
    strapi: Core.Strapi,
): Promise<Map<string, DonationStats>> => {
    const nocoBaseUrl = process.env.IWKZ_NOCODB_API;
    const nocoToken = process.env.IWKZ_NOCODB_API_TOKEN;

    if (!nocoBaseUrl || !nocoToken) {
        strapi.log.warn(
            'Donation stats skipped: IWKZ_NOCODB_API or IWKZ_NOCODB_API_TOKEN is not configured.',
        );
        return new Map<string, DonationStats>();
    }

    const apiUrl = `${nocoBaseUrl}/tables/${DONATION_TABLE_ID}/records`;

    try {
        const response = await axios.get<NocoDonationResponse>(apiUrl, {
            headers: {
                accept: 'application/json',
                'xc-token': nocoToken,
            },
        });

        const records = response.data?.list ?? [];
        return buildStatsMap(records);
    } catch (error) {
        strapi.log.error('Failed to fetch donation stats from NocoDB.', error);
        return new Map<string, DonationStats>();
    }
};

const getPaypalAccessToken = async (strapi: Core.Strapi): Promise<string> => {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        strapi.log.error(
            'PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not configured.',
        );
        throw new Error('PayPal configuration is incomplete.');
    }

    try {
        const tokenUrl = `${PAYPAL_BASE_URL}/v1/oauth2/token`;
        const response = await axios.post<PaypalAccessTokenResponse>(
            tokenUrl,
            'grant_type=client_credentials',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                auth: {
                    username: clientId,
                    password: clientSecret,
                },
            },
        );

        if (!response.data?.access_token) {
            strapi.log.error(
                'PayPal token response does not include access token.',
            );
            throw new Error('PayPal authentication failed.');
        }

        return response.data.access_token;
    } catch (error) {
        strapi.log.error('Failed to get PayPal access token.', error);
        throw new Error('Unable to authenticate with PayPal.');
    }
};

const getPaypalRedirectUrls = async (
    strapi: Core.Strapi,
): Promise<{
    returnUrl: string;
    cancelUrl: string;
    fixFeeMinor: number;
    percentageFeeBps: number;
}> => {
    try {
        const paymentConfig = (await strapi.entityService.findMany(
            'api::payment-config.payment-config',
            {
                populate: {
                    paypal: true,
                },
            },
        )) as PaymentConfigEntity | null;

        const returnUrl = paymentConfig?.paypal?.returnUrl?.trim();
        const cancelUrl = paymentConfig?.paypal?.cancelUrl?.trim();

        const fixFeeAmount = toNumber(paymentConfig?.paypal?.fixFee); // value is in currency units (e.g., EUR)
        const percentageFee = toNumber(paymentConfig?.paypal?.percentageFee); // value is in percent (e.g., 2.5 means 2.5%)

        const fixFeeMinor = Math.round(fixFeeAmount * 100); // convert to minor units
        const percentageFeeBps = Math.round(percentageFee * 100); // convert percent to basis points

        if (!returnUrl || !cancelUrl) {
            strapi.log.error(
                'PayPal redirect URL config is missing in payment-config.paypal.',
            );
            throw new Error('PayPal redirect URL is not configured.');
        }

        if (
            fixFeeMinor < 0 ||
            percentageFeeBps < 0 ||
            percentageFeeBps >= 10000
        ) {
            strapi.log.error('Invalid PayPal fee configuration detected.', {
                fixFeeAmount,
                percentageFee,
                fixFeeMinor,
                percentageFeeBps,
            });
            throw new Error('PayPal fee configuration is invalid.');
        }

        return { returnUrl, cancelUrl, fixFeeMinor, percentageFeeBps };
    } catch (error) {
        strapi.log.error(
            'Failed to read PayPal redirect config from payment-config.',
            error,
        );
        throw new Error('Unable to resolve PayPal redirect configuration.');
    }
};

const createPaypalOrder = async (
    strapi: Core.Strapi,
    payload: CreatePaypalPaymentInput,
): Promise<PaypalPaymentLinkResponse> => {
    const accessToken = await getPaypalAccessToken(strapi);
    const { returnUrl, cancelUrl, fixFeeMinor, percentageFeeBps } =
        await getPaypalRedirectUrls(strapi);
    const netAmount = roundToCurrency(payload.total_price);
    const fixedFee = roundToCurrency(fixFeeMinor / 100);
    const percentageFeeRate = percentageFeeBps / 10000;
    const grossAmount = ceilToCurrency(
        (netAmount + fixedFee) / (1 - percentageFeeRate),
    );
    const feeAmount = roundToCurrency(grossAmount - netAmount);

    if (grossAmount <= 0 || feeAmount < 0) {
        strapi.log.error('Invalid gross-up result for PayPal order.', {
            netAmount,
            grossAmount,
            feeAmount,
            fixFeeMinor,
            percentageFeeBps,
        });
        throw new Error('Unable to calculate PayPal gross amount.');
    }

    const donationCaptureId = generateDonationCaptureId();

    const descriptionMap = payload.items.reduce(
        (acc, item) => {
            const code = item.unique_code?.trim();
            if (!code) return acc;

            const desc = item.description?.trim();
            if (!acc[code]) acc[code] = [];
            if (desc) acc[code].push(desc);
            return acc;
        },
        {} as Record<string, string[]>,
    );

    const description = Object.entries(descriptionMap)
        .map(([code, descriptions]) => `${code}[${descriptions.join(',')}]`)
        .join(',');

    const customId = donationCaptureId;
    const paypalItems = payload.items.map((item) => ({
        name: `${item.unique_code} x${item.total_order}`.slice(0, 127),
        quantity: '1',
        unit_amount: {
            currency_code: PAYPAL_CURRENCY,
            value: item.total_price.toFixed(2),
        },
    }));

    if (feeAmount > 0) {
        paypalItems.push({
            name: 'PayPal processing fee',
            quantity: '1',
            unit_amount: {
                currency_code: PAYPAL_CURRENCY,
                value: feeAmount.toFixed(2),
            },
        });
    }

    const orderPayload: Record<string, unknown> = {
        intent: 'CAPTURE',
        purchase_units: [
            {
                reference_id: `donation_${Date.now()}`,
                custom_id: customId,
                description,
                amount: {
                    currency_code: PAYPAL_CURRENCY,
                    value: grossAmount.toFixed(2),
                    breakdown: {
                        item_total: {
                            currency_code: PAYPAL_CURRENCY,
                            value: grossAmount.toFixed(2),
                        },
                    },
                },
                items: paypalItems,
            },
        ],
    };

    orderPayload.application_context = {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        user_action: 'PAY_NOW',
    };

    try {
        const orderUrl = `${PAYPAL_BASE_URL}/v2/checkout/orders`;
        const response = await axios.post<PaypalOrderResponse>(
            orderUrl,
            orderPayload,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            },
        );

        const approvalUrl = response.data?.links?.find(
            (link) => link.rel === 'approve',
        )?.href;

        if (!approvalUrl || !response.data?.id) {
            strapi.log.error('PayPal order response missing approval link.', {
                orderId: response.data?.id,
            });
            throw new Error('PayPal approval link is unavailable.');
        }

        await savePendingDonationToNocoDB(
            strapi,
            donationCaptureId,
            payload.items,
        );

        return {
            orderId: response.data.id,
            approvalUrl,
            netAmount,
            grossAmount,
            feeAmount,
        };
    } catch (error) {
        strapi.log.error('Failed to create PayPal order.', error);
        throw new Error('Unable to create PayPal payment link.');
    }
};

const parseDescriptionsFromPaypal = (
    description: string | undefined,
): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    if (!description) return map;

    const regex = /([^,\[\]]+)\[([^\]]*)\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(description)) !== null) {
        const code = match[1]?.trim();
        if (!code) continue;

        const descs = match[2]
            .split(',')
            .map((d) => d.trim())
            .filter((d) => d.length > 0);

        map.set(code, descs);
    }

    return map;
};

const parseItemsFromCustomId = (
    customId: string | undefined,
): Array<{ unique_code: string; total_order: number; total_price: number }> => {
    if (!customId) return [];

    return customId
        .split('|')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => {
            const [uniqueCode, totalOrderRaw, totalPriceRaw] = entry.split(':');
            const totalOrder = toNumber(totalOrderRaw);
            const totalPrice = toNumber(totalPriceRaw);

            return {
                unique_code: (uniqueCode ?? '').trim(),
                total_order: totalOrder,
                total_price: totalPrice,
            };
        })
        .filter(
            (item) =>
                item.unique_code.length > 0 &&
                item.total_order > 0 &&
                item.total_price > 0,
        );
};

const savePendingDonationToNocoDB = async (
    strapi: Core.Strapi,
    captureId: string,
    items: Array<{
        unique_code: string;
        total_order: number;
        total_price: number;
        description?: string;
    }>,
): Promise<void> => {
    const nocoBaseUrl = process.env.IWKZ_NOCODB_API;
    const nocoToken = process.env.IWKZ_NOCODB_API_TOKEN;

    if (!nocoBaseUrl || !nocoToken || !DONATION_TABLE_ID) {
        strapi.log.error(
            'NocoDB configuration is incomplete for donation capture sync.',
        );
        throw new Error('NocoDB configuration is incomplete.');
    }

    const apiUrl = `${nocoBaseUrl}/tables/${DONATION_TABLE_ID}/records`;
    const where = encodeURIComponent(`(capture_id,eq,${captureId})`);
    const listUrl = `${apiUrl}?where=${where}&limit=100&shuffle=0&offset=0`;

    try {
        const existingResponse = await axios.get<NocoDonationResponse>(
            listUrl,
            {
                headers: {
                    accept: 'application/json',
                    'xc-token': nocoToken,
                },
            },
        );

        const existingRows = existingResponse.data?.list ?? [];
        for (const row of existingRows) {
            const rowId =
                (row as { id?: unknown; Id?: unknown }).Id ??
                (row as { id?: unknown; Id?: unknown }).id;
            if (!rowId) continue;

            await axios.delete(`${apiUrl}/${rowId}`, {
                headers: {
                    accept: 'application/json',
                    'xc-token': nocoToken,
                },
            });
        }
    } catch (error) {
        strapi.log.error(
            'Failed to prepare NocoDB rows for donation capture.',
            error,
        );
        throw new Error('Failed to prepare donation capture storage.');
    }

    const records = items.map((item) => ({
        capture_id: captureId,
        donation_code: item.unique_code,
        total_order: item.total_order,
        total_price: item.total_price,
        description: item.description ?? '',
        is_completed: false,
        transaction_id: '',
    }));

    try {
        for (const record of records) {
            await axios.post(apiUrl, record, {
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                    'xc-token': nocoToken,
                },
            });
        }
    } catch (error) {
        strapi.log.error('Failed to save pending donation to NocoDB.', error);
        throw new Error('Failed to persist pending donation.');
    }
};

const fetchDonationItemsFromNocoDB = async (
    strapi: Core.Strapi,
    captureId: string,
): Promise<
    Array<{
        unique_code: string;
        total_order: number;
        total_price: number;
        description?: string;
    }>
> => {
    const nocoBaseUrl = process.env.IWKZ_NOCODB_API;
    const nocoToken = process.env.IWKZ_NOCODB_API_TOKEN;

    if (!nocoBaseUrl || !nocoToken || !DONATION_TABLE_ID) {
        return [];
    }

    const apiUrl = `${nocoBaseUrl}/tables/${DONATION_TABLE_ID}/records`;
    const where = encodeURIComponent(`(capture_id,eq,${captureId})`);
    const listUrl = `${apiUrl}?where=${where}&limit=100&shuffle=0&offset=0`;

    try {
        const response = await axios.get<NocoDonationResponse>(listUrl, {
            headers: {
                accept: 'application/json',
                'xc-token': nocoToken,
            },
        });

        const rows = response.data?.list ?? [];
        return rows
            .map((row) => ({
                unique_code: row.donation_code?.trim() ?? '',
                total_order: toNumber(row.total_order),
                total_price: toNumber(row.total_price),
                description: row.description ?? '',
            }))
            .filter(
                (item) =>
                    item.unique_code.length > 0 &&
                    item.total_order > 0 &&
                    item.total_price > 0,
            );
    } catch (error) {
        strapi.log.error('Failed to fetch donation items from NocoDB.', error);
        return [];
    }
};

const markDonationCaptureCompletedInNocoDB = async (
    strapi: Core.Strapi,
    captureId: string,
    transactionId: string,
): Promise<void> => {
    const nocoBaseUrl = process.env.IWKZ_NOCODB_API;
    const nocoToken = process.env.IWKZ_NOCODB_API_TOKEN;

    if (!nocoBaseUrl || !nocoToken || !DONATION_TABLE_ID) {
        strapi.log.error(
            'NocoDB configuration is incomplete for donation capture sync.',
        );
        throw new Error('NocoDB configuration is incomplete.');
    }

    const apiUrl = `${nocoBaseUrl}/tables/${DONATION_TABLE_ID}/records`;
    const where = encodeURIComponent(`(capture_id,eq,${captureId})`);
    const listUrl = `${apiUrl}?where=${where}&limit=100&shuffle=0&offset=0`;

    try {
        const response = await axios.get<NocoDonationResponse>(listUrl, {
            headers: {
                accept: 'application/json',
                'xc-token': nocoToken,
            },
        });

        const rows = response.data?.list ?? [];
        if (rows.length === 0) {
            strapi.log.warn('No NocoDB rows found for capture id.', {
                captureId,
            });
            return;
        }

        for (const row of rows) {
            const { created_at, updated_at, ...restData } = row;
            await axios.patch(
                `${apiUrl}`,
                {
                    ...restData,
                    is_completed: 1,
                    transaction_id: transactionId,
                },
                {
                    headers: {
                        accept: 'application/json',
                        'Content-Type': 'application/json',
                        'xc-token': nocoToken,
                    },
                },
            );
        }
    } catch (error) {
        strapi.log.error(
            'Failed to mark donation capture as completed in NocoDB.',
            error,
        );
        throw new Error('Failed to update donation capture status.');
    }
};

const saveBankTransferDonationToNocoDB = async (
    strapi: Core.Strapi,
    payload: CreateBankTransferDonationInput,
): Promise<void> => {
    const nocoBaseUrl = process.env.IWKZ_NOCODB_API;
    const nocoToken = process.env.IWKZ_NOCODB_API_TOKEN;
    const date = new Date();
    const captureId =
        'bankTransfer-' +
        date.getFullYear() +
        '_' +
        (date.getMonth() + 1) +
        '_' +
        date.getDate();

    if (!nocoBaseUrl || !nocoToken || !DONATION_TABLE_ID) {
        strapi.log.error(
            'NocoDB configuration is incomplete for bank transfer donation sync.',
        );
        throw new Error('NocoDB configuration is incomplete.');
    }

    const apiUrl = `${nocoBaseUrl}/tables/${DONATION_TABLE_ID}/records`;
    const records = payload.items.map((item) => ({
        capture_id: captureId,
        donation_code: item.donation_code,
        total_order: item.total_order,
        total_price: item.total_price,
        description: item.description,
        is_completed: true,
    }));

    try {
        for (const record of records) {
            await axios.post(apiUrl, record, {
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                    'xc-token': nocoToken,
                },
            });
        }
    } catch (error) {
        strapi.log.error('Failed to save captured donation to NocoDB.', error);
        throw new Error('Failed to persist donation capture.');
    }
};

const capturePaypalOrder = async (
    strapi: Core.Strapi,
    payload: CapturePaypalPaymentInput,
): Promise<{
    orderId: string;
    captureId: string;
    status: string;
    items: Array<{
        unique_code: string;
        total_order: number;
        total_price: number;
    }>;
}> => {
    const accessToken = await getPaypalAccessToken(strapi);
    const captureUrl = `${PAYPAL_BASE_URL}/v2/checkout/orders/${payload.order_id}/capture`;

    try {
        const response = await axios.post<PaypalCaptureOrderResponse>(
            captureUrl,
            {},
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            },
        );

        const orderId = response.data?.id ?? payload.order_id;
        const captureStatus = response.data?.status ?? '';
        const firstPurchaseUnit = response.data?.purchase_units?.[0];
        const capture = firstPurchaseUnit?.payments?.captures?.[0];
        const finalStatus = capture?.status ?? captureStatus;
        const paypalTransactionId = capture?.id ?? '';
        const donationCaptureId =
            capture?.custom_id ?? firstPurchaseUnit?.custom_id ?? '';
        const descriptionMap = parseDescriptionsFromPaypal(
            firstPurchaseUnit?.description,
        );
        let items = await fetchDonationItemsFromNocoDB(
            strapi,
            donationCaptureId,
        );

        if (items.length === 0) {
            items = parseItemsFromCustomId(donationCaptureId);
        }

        const itemsWithDescription = items.map((item) => ({
            ...item,
            description:
                (item.description ?? '').trim() ||
                descriptionMap.get(item.unique_code)?.join(',') ||
                '',
        }));

        if (finalStatus !== 'COMPLETED') {
            strapi.log.warn('PayPal capture is not completed.', {
                orderId,
                status: finalStatus,
            });
            throw new Error('PayPal capture is not completed.');
        }

        if (!paypalTransactionId) {
            strapi.log.error('PayPal capture response missing capture id.', {
                orderId,
            });
            throw new Error('PayPal capture id is missing.');
        }

        if (!donationCaptureId) {
            strapi.log.error('PayPal capture response missing custom id.', {
                orderId,
            });
            throw new Error('PayPal donation capture id is missing.');
        }

        if (itemsWithDescription.length === 0) {
            strapi.log.error('No donation items found in PayPal custom_id.', {
                orderId,
                captureCustomId: donationCaptureId,
            });
            throw new Error('No donation items found for this payment.');
        }

        await markDonationCaptureCompletedInNocoDB(
            strapi,
            donationCaptureId,
            paypalTransactionId,
        );

        return {
            orderId,
            captureId: paypalTransactionId,
            status: finalStatus,
            items: itemsWithDescription,
        };
    } catch (error) {
        strapi.log.error('Failed to capture PayPal order.', error);
        throw new Error('Unable to capture PayPal payment.');
    }
};

const donationPackageService = ({ strapi }: { strapi: Core.Strapi }) => ({
    async findWithStatus() {
        try {
            const entity = (await strapi.entityService.findMany(
                'api::donation-package.donation-package',
                {
                    populate: {
                        image: true,
                        donationPackages: {
                            populate: {
                                image: true,
                                donationItems: true,
                            },
                        },
                    },
                },
            )) as DonationPackageEntity | null;

            if (!entity) {
                strapi.log.warn(
                    'Donation package single type is empty or not found.',
                );
                return null;
            }

            const statsMap = await fetchDonationStats(strapi);
            const enrichedPackages = enrichDonationPackages(
                entity.donationPackages ?? [],
                statsMap,
            );

            return {
                ...entity,
                donationPackages: enrichedPackages,
            };
        } catch (error) {
            strapi.log.error(
                'Failed to build donation package response.',
                error,
            );
            throw error;
        }
    },
    async createPaypalPaymentLink(payload: CreatePaypalPaymentInput) {
        try {
            return await createPaypalOrder(strapi, payload);
        } catch (error) {
            strapi.log.error('Failed to build PayPal payment link.', error);
            throw error;
        }
    },
    async capturePaypalPayment(payload: CapturePaypalPaymentInput) {
        try {
            return await capturePaypalOrder(strapi, payload);
        } catch (error) {
            strapi.log.error('Failed to handle PayPal capture.', error);
            throw error;
        }
    },
    async createBankTransferDonation(payload: CreateBankTransferDonationInput) {
        try {
            await saveBankTransferDonationToNocoDB(strapi, payload);
            return {
                items: payload.items,
            };
        } catch (error) {
            strapi.log.error(
                'Failed to handle bank transfer donation creation.',
                error,
            );
            throw error;
        }
    },
});

export default factories.createCoreService(
    'api::donation-package.donation-package',
    donationPackageService,
);
