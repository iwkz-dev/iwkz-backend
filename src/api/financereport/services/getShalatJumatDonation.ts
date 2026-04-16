import { evaluateMonthlyData, sendGetRequest } from './financereport.helper';
import {
  DBFinanceData,
  FinanceDataApiResponse,
  FinanceMonthlyData,
  FinanceReportType,
} from '../controllers/types';

const DEFAULT_DATA_LIMIT = 'limit=1000';

const getShalatJumatDonation = async (
  year: number,
  month?: number
): Promise<FinanceDataApiResponse> => {
  const monthFilter = month ? `~and(month,eq,${month}` : '';
  const apiUri = `tables/${process.env.IWKZ_NOCODB_TABLE_SHALAT_JUMAT}/records?where=(year,eq,${year})${monthFilter}&${DEFAULT_DATA_LIMIT}`;

  strapi.log.info(
    `[getShalatJumatDonation] apiUri=${apiUri}, filter=${JSON.stringify({ year, month })}`
  );
  let monthlyData: FinanceMonthlyData[];

  try {
    const result = (await sendGetRequest(apiUri)) as DBFinanceData[];

    monthlyData = await evaluateMonthlyData(result);
  } catch (error) {
    strapi.log.error(error);
  }

  return {
    year: 123,
    type: FinanceReportType.JUMATAN,
    monthlyData,
  };
};

export { getShalatJumatDonation };
