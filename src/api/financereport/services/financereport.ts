/**
 * financereport service
 */
import axios from 'axios';
import {
    DBFinanceDataResponse,
    FinanceReportType,
    DBFinanceData,
    FinanceDataApiResponse,
    FinanceMonthlyData,
    FinanceCashFlowType,
    FinanceSummaryApiResponse,
    FinanceMonthlySummary,
    DBLedgerData,
    DBFinanceCashFlow,
    DBFinanceClosingBalance,
} from '../controllers/types';

const API_URL = `${process.env.IWKZ_NOCODB_API}/`;
const DEFAULT_DATA_LIMIT = 'limit=1000';

const getLedger = async (): Promise<DBLedgerData[]> => {
    const apiUri = `tables/${process.env.IWKZ_NOCODB_TABLE_KEUANGAN_LEDGER}/records?${DEFAULT_DATA_LIMIT}`;
    let result: DBLedgerData[];

    strapi.log.info(`apiURL: ${apiUri}`);

    try {
        result = (await sendGetRequest(apiUri)) as DBLedgerData[];
    } catch (error) {
        strapi.log.error(error);
    }

    return result;
};

const getOperationalReport = async (
    year: number,
    month?: number
): Promise<FinanceDataApiResponse> => {
    const monthFilter = month ? `~and(month,eq,${month}` : '';
    const apiUri = `tables/${process.env.IWKZ_NOCODB_TABLE_KEUANGAN_OPERASIONAL}/records?where=(year,eq,${year})${monthFilter}&${DEFAULT_DATA_LIMIT}`;
    let monthlyData: FinanceMonthlyData[];

    strapi.log.info(`apiURL: ${apiUri}`);

    try {
        const result = (await sendGetRequest(apiUri)) as DBFinanceData[];

        monthlyData = evaluateMonthlyData(result);
    } catch (error) {
        strapi.log.error(error);
    }

    return {
        year,
        type: FinanceReportType.OPERASIONAL,
        monthlyData,
    };
};

const getPRSReport = async (
    year: number,
    month?: number
): Promise<FinanceDataApiResponse> => {
    const monthFilter = month ? `~and(month,eq,${month}` : '';
    const apiUri = `tables/${process.env.IWKZ_NOCODB_TABLE_KEUANGAN_PRS}/records?where=(year,eq,${year})${monthFilter}&${DEFAULT_DATA_LIMIT}`;
    let monthlyData: FinanceMonthlyData[];

    strapi.log.info(`apiURL: ${apiUri}`);

    try {
        const result = (await sendGetRequest(apiUri)) as DBFinanceData[];

        monthlyData = evaluateMonthlyData(result);
    } catch (error) {
        strapi.log.error(error);
    }

    return {
        year,
        type: FinanceReportType.PRS,
        monthlyData,
    };
};

const getBalanceSummaries = async (
    year: number
): Promise<FinanceSummaryApiResponse> => {
    const apiUriCashFlow = `tables/${process.env.IWKZ_NOCODB_TABLE_KEUANGAN_CASHFLOW}/records?where=(year,eq,${year})&${DEFAULT_DATA_LIMIT}`;
    const apiClosingBalanceLastYear = `tables/${process.env.IWKZ_NOCODB_TABLE_KEUANGAN_CLOSINGBALANCE}/records?where=(year,eq,${year - 1})&${DEFAULT_DATA_LIMIT}`;

    strapi.log.info(`apiUriCashFlow: ${apiUriCashFlow}`);
    strapi.log.info(`apiClosingBalanceLastYear: ${apiClosingBalanceLastYear}`);

    const operationalMonthlySummary: FinanceMonthlySummary[] = [];
    const prsMonthlySummary: FinanceMonthlySummary[] = [];
    let resultCashflow: DBFinanceCashFlow[];
    let resultClosingBalanceLastYear: DBFinanceClosingBalance[];

    try {
        resultCashflow = await sendGetRequest(apiUriCashFlow);
        resultClosingBalanceLastYear = await sendGetRequest(
            apiClosingBalanceLastYear
        );

        resultCashflow.forEach(({ month, income, outcome, data_type }) => {
            const tmpData = {
                month,
                [FinanceCashFlowType.INFLOW]: income,
                [FinanceCashFlowType.OUTFLOW]: outcome,
            };
            if (data_type === FinanceReportType.OPERASIONAL) {
                operationalMonthlySummary.push(tmpData);
            } else if (data_type === FinanceReportType.PRS) {
                prsMonthlySummary.push(tmpData);
            }
        });
    } catch (error) {
        strapi.log.error(error);
    }

    console.log(resultCashflow);

    return {
        year,
        [FinanceReportType.OPERASIONAL]: {
            monthlyData: operationalMonthlySummary,
            lastyearIncomeBalance: getClosingBalanceValue(
                resultClosingBalanceLastYear,
                FinanceReportType.OPERASIONAL
            ),
        },
        [FinanceReportType.PRS]: {
            monthlyData: prsMonthlySummary,
            lastyearIncomeBalance: getClosingBalanceValue(
                resultClosingBalanceLastYear,
                FinanceReportType.PRS
            ),
        },
    };
};

const getClosingBalanceValue = (
    data: DBFinanceClosingBalance[],
    financeReport: FinanceReportType
) => {
    const closingBalanceData: DBFinanceClosingBalance = data.find(
        ({ data_type }) => data_type === financeReport
    );
    return closingBalanceData.total_income || 0;
};

const evaluateMonthlyData = (data: DBFinanceData[]): FinanceMonthlyData[] => {
    const monthlyDataMap = new Map<number, FinanceMonthlyData>();

    data.forEach(({ month, ledger_id, income, outcome }) => {
        if (income === null) income = 0;
        if (outcome === null) outcome = 0;
        if (ledger_id === null) ledger_id = 0;

        //make sure outcome as a minus value
        outcome = outcome > 0 ? outcome * -1 : outcome;

        const total = income !== 0 ? income : outcome;
        const cashFlowType =
            outcome !== 0
                ? FinanceCashFlowType.OUTFLOW
                : FinanceCashFlowType.INFLOW;

        if (!monthlyDataMap.has(month)) {
            monthlyDataMap.set(month, {
                month,
                [FinanceCashFlowType.OUTFLOW]: { ledgerData: [] },
                [FinanceCashFlowType.INFLOW]: { ledgerData: [] },
            });
        }
        const monthData = monthlyDataMap.get(month)!;

        const ledgerIndex = monthData[cashFlowType].ledgerData.findIndex(
            (item) => item.ledgerId === ledger_id
        );

        if (ledgerIndex >= 0) {
            monthData[cashFlowType].ledgerData[ledgerIndex].total += total;
        } else {
            monthData[cashFlowType].ledgerData.push({
                ledgerId: ledger_id,
                total,
            });
        }
    });

    return Array.from(monthlyDataMap.values()).sort(
        (a, b) => a.month - b.month
    );
};

const sendGetRequest = async (apiUri: string) => {
    let isLastData = false;
    const data = [];
    let pageCounter = 1;

    while (!isLastData) {
        const response = await axios.get(
            `${API_URL}${apiUri}&page=${pageCounter}`,
            {
                headers: {
                    accept: 'application/json',
                    'xc-token': process.env.IWKZ_NOCODB_API_TOKEN,
                },
            }
        );
        const responseData = (await response.data) as DBFinanceDataResponse;

        isLastData = responseData.pageInfo.isLastPage;
        data.push(...responseData.list);

        strapi.log.info(
            `[sendGetRequest] isLastData: ${isLastData}, dataLenght: ${data.length}, pageCounter: ${pageCounter}`
        );

        pageCounter++;
    }

    return data;
};

export { getOperationalReport, getPRSReport, getLedger, getBalanceSummaries };
