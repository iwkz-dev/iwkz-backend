import { DBLedgerData } from '../controllers/types';
import { sendGetRequest } from './financereport.helper';

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

export { getLedger };
