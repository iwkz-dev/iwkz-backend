import {
  DBFinanceData,
  FinanceDataApiResponse,
  FinanceMonthlyData,
  FinanceReportType,
} from '../controllers/types';
import { evaluateMonthlyData, sendGetRequest } from './financereport.helper';

const DEFAULT_DATA_LIMIT = 'limit=1000';

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

    monthlyData = await evaluateMonthlyData(result);
  } catch (error) {
    strapi.log.error(error);
  }

  return {
    year,
    type: FinanceReportType.PRS,
    monthlyData,
  };
};

export { getPRSReport };
