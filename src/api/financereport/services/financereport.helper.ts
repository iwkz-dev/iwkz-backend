import axios from 'axios';
import {
  DBFinanceData,
  FinanceMonthlyData,
  FinanceCashFlowType,
  DBFinanceDataResponse,
} from '../controllers/types';
import { getLedger } from './getLedger';

const API_URL = `${process.env.IWKZ_NOCODB_API}/`;

const evaluateMonthlyData = async (
  data: DBFinanceData[]
): Promise<FinanceMonthlyData[]> => {
  const monthlyDataMap = new Map<number, FinanceMonthlyData>();
  const ledgerNameById = await createLedgerNameMap();

  data.forEach(({ month, ledger_id, income, outcome }) => {
    if (income === null) income = 0;
    if (outcome === null) outcome = 0;
    if (ledger_id === null) ledger_id = 0;

    //make sure outcome as a minus value
    outcome = outcome > 0 ? outcome * -1 : outcome;

    const total = income !== 0 ? income : outcome;
    const cashFlowType =
      outcome !== 0 ? FinanceCashFlowType.OUTFLOW : FinanceCashFlowType.INFLOW;

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
      const ledgerName = ledger_id === 0 ? '-' : ledgerNameById[ledger_id];

      monthData[cashFlowType].ledgerData.push({
        ledgerId: ledger_id,
        total,
        ledgerName,
      });
    }
  });

  return Array.from(monthlyDataMap.values()).sort((a, b) => a.month - b.month);
};

const createLedgerNameMap = async (): Promise<Record<number, string>> => {
  const ledgerData = (await getLedger()) ?? [];

  return Object.fromEntries(
    ledgerData.map(({ ledger_id, label }) => [ledger_id, label ?? '-'])
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

export { sendGetRequest, evaluateMonthlyData };
