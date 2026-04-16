import { FinanceDonationPackageStatistics } from '../controllers/types';
import { sendGetRequest } from './financereport.helper';

const DEFAULT_DATA_LIMIT = 'limit=1000';

type DonationPackageRecord = {
  CreatedAt?: string | null;
  is_completed?: number | 0;
  total_order?: number | 0;
  total_price?: number | 0;
};

type DonationPackageStatisticsFilter = {
  year?: number;
  month?: number;
};

const getDonationPackageStatistics = async (
  donationCode: string,
  filter?: DonationPackageStatisticsFilter
): Promise<FinanceDonationPackageStatistics> => {
  const apiUri = `tables/${process.env.IWKZ_NOCODB_TABLE_DONATIONPACKAGE}/records?where=(donation_code,eq,${encodeURIComponent(
    donationCode
  )})&${DEFAULT_DATA_LIMIT}`;

  strapi.log.info(
    `[getDonationPackageStatistics] apiUri=${apiUri}, filter=${JSON.stringify(
      filter ?? {}
    )}`
  );

  try {
    const result = (await sendGetRequest(apiUri)) as DonationPackageRecord[];
    const filteredResult = result.filter((record) =>
      matchesDonationPackageDateFilter(record, filter)
    );

    return filteredResult.reduce(
      (acc, curr) => {
        if (curr.is_completed === 0) {
          return acc; // skip incomplete donation packages
        }
        return {
          totalOrder: acc.totalOrder + (curr.total_order ?? 0),
          totalPrice: acc.totalPrice + (curr.total_price ?? 0),
        };
      },
      { totalOrder: 0, totalPrice: 0 }
    );
  } catch (error) {
    strapi.log.error(error);
    return { totalOrder: 0, totalPrice: 0 };
  }
};

const matchesDonationPackageDateFilter = (
  record: DonationPackageRecord,
  filter?: DonationPackageStatisticsFilter
) => {
  if (!filter?.year && !filter?.month) {
    return true;
  }

  if (!record.CreatedAt) {
    return false;
  }

  const createdAt = new Date(record.CreatedAt);

  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  const matchesYear = filter.year
    ? createdAt.getUTCFullYear() === filter.year
    : true;
  const matchesMonth = filter.month
    ? createdAt.getUTCMonth() + 1 === filter.month
    : true;

  return matchesYear && matchesMonth;
};

export { getDonationPackageStatistics };
