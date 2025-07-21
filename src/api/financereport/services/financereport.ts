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
} from '../controllers/types';

const API_URL = `${process.env.IWKZ_NOCODB_API}/`;

const getPRSReport = async (
    year: number,
    month?: number
): Promise<FinanceDataApiResponse> => {
    const monthFilter = month ? `~and(month,eq,${month}` : '';
    const apiUri = `tables/${process.env.IWKZ_NOCODB_TABLE_KEUANGAN_PRS}/records?where=(year,eq,${year})${monthFilter}&limit=1000`;
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

const evaluateMonthlyData = (data: DBFinanceData[]): FinanceMonthlyData[] => {
    const monthlyDataMap = new Map<number, FinanceMonthlyData>();

    data.forEach(({ month, ledger_id, income, outcome }) => {
        if (income === null) income = 0;
        if (outcome === null) outcome = 0;

        const total = income !== 0 ? income : outcome;

        if (!monthlyDataMap.has(month)) {
            monthlyDataMap.set(month, {
                month,
                ledgerData: [],
            });
        }
        const monthData = monthlyDataMap.get(month)!;

        const ledgerIndex = monthData.ledgerData.findIndex(
            (item) => item.ledgerId === ledger_id
        );

        if (ledgerIndex >= 0) {
            monthData.ledgerData[ledgerIndex].total += total;
        } else {
            monthData.ledgerData.push({
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

export { getPRSReport };
