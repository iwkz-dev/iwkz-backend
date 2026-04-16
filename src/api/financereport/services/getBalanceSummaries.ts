import {
  DBFinanceCashFlow,
  DBFinanceClosingBalance,
  FinanceCashFlowType,
  FinanceMonthlySummary,
  FinanceReportType,
  FinanceSummaryApiResponse,
} from '../controllers/types';
import { sendGetRequest } from './financereport.helper';

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

export { getBalanceSummaries };
