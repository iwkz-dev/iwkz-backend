import type { Core } from '@strapi/strapi';
import axios from 'axios';
import type {
  CreateBankTransferDonationInput,
  NocoDonationResponse,
} from '../types/donation-package';
import { toNumber } from './donation-package.utils';

export type DonationCaptureItem = {
  unique_code: string;
  total_order: number;
  total_price: number;
  description?: string;
};

const DONATION_TABLE_ID = process.env.IWKZ_NOCODB_TABLE_DONATIONPACKAGE;

const getNocoSettings = () => {
  const baseUrl = process.env.IWKZ_NOCODB_API;
  const token = process.env.IWKZ_NOCODB_API_TOKEN;
  return { baseUrl, token, tableId: DONATION_TABLE_ID };
};

const buildRecordsApiUrl = (baseUrl: string, tableId: string) =>
  `${baseUrl}/tables/${tableId}/records`;

const buildCaptureListUrl = (recordsUrl: string, captureId: string) => {
  const where = encodeURIComponent(`(capture_id,eq,${captureId})`);
  return `${recordsUrl}?where=${where}&limit=100&shuffle=0&offset=0`;
};

const getRowId = (row: { id?: unknown; Id?: unknown }): unknown =>
  row.Id ?? row.id;

export const savePendingDonationToNocoDB = async (
  strapi: Core.Strapi,
  captureId: string,
  items: DonationCaptureItem[]
): Promise<void> => {
  const { baseUrl, token, tableId } = getNocoSettings();
  if (!baseUrl || !token || !tableId) {
    strapi.log.error(
      'NocoDB configuration is incomplete for donation capture sync.'
    );
    throw new Error('NocoDB configuration is incomplete.');
  }

  const recordsUrl = buildRecordsApiUrl(baseUrl, tableId);
  const listUrl = buildCaptureListUrl(recordsUrl, captureId);

  try {
    const existingResponse = await axios.get<NocoDonationResponse>(listUrl, {
      headers: {
        accept: 'application/json',
        'xc-token': token,
      },
    });

    const existingRows = existingResponse.data?.list ?? [];
    for (const row of existingRows) {
      const rowId = getRowId(row as { id?: unknown; Id?: unknown });
      if (!rowId) continue;

      await axios.delete(`${recordsUrl}/${rowId}`, {
        headers: {
          accept: 'application/json',
          'xc-token': token,
        },
      });
    }
  } catch (error) {
    strapi.log.error(
      'Failed to prepare NocoDB rows for donation capture.',
      error
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
      await axios.post(recordsUrl, record, {
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          'xc-token': token,
        },
      });
    }
  } catch (error) {
    strapi.log.error('Failed to save pending donation to NocoDB.', error);
    throw new Error('Failed to persist pending donation.');
  }
};

export const fetchDonationItemsFromNocoDB = async (
  strapi: Core.Strapi,
  captureId: string
): Promise<DonationCaptureItem[]> => {
  const { baseUrl, token, tableId } = getNocoSettings();
  if (!baseUrl || !token || !tableId) return [];

  const recordsUrl = buildRecordsApiUrl(baseUrl, tableId);
  const listUrl = buildCaptureListUrl(recordsUrl, captureId);

  try {
    const response = await axios.get<NocoDonationResponse>(listUrl, {
      headers: {
        accept: 'application/json',
        'xc-token': token,
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
          item.total_price > 0
      );
  } catch (error) {
    strapi.log.error('Failed to fetch donation items from NocoDB.', error);
    return [];
  }
};

export const markDonationCaptureCompletedInNocoDB = async (
  strapi: Core.Strapi,
  captureId: string,
  transactionId: string
): Promise<void> => {
  const { baseUrl, token, tableId } = getNocoSettings();
  if (!baseUrl || !token || !tableId) {
    strapi.log.error(
      'NocoDB configuration is incomplete for donation capture sync.'
    );
    throw new Error('NocoDB configuration is incomplete.');
  }

  const recordsUrl = buildRecordsApiUrl(baseUrl, tableId);
  const listUrl = buildCaptureListUrl(recordsUrl, captureId);

  try {
    const response = await axios.get<NocoDonationResponse>(listUrl, {
      headers: {
        accept: 'application/json',
        'xc-token': token,
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
      const { CreatedAt, UpdatedAt, ...restData } = row;

      await axios.patch(
        `${recordsUrl}`,
        {
          ...restData,
          is_completed: 1,
          transaction_id: transactionId,
        },
        {
          headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'xc-token': token,
          },
        }
      );
    }
  } catch (error) {
    strapi.log.error(
      'Failed to mark donation capture as completed in NocoDB.',
      error
    );
    throw new Error('Failed to update donation capture status.');
  }
};

export const saveBankTransferDonationToNocoDB = async (
  strapi: Core.Strapi,
  payload: CreateBankTransferDonationInput
): Promise<void> => {
  const { baseUrl, token, tableId } = getNocoSettings();
  const date = new Date();
  const captureId =
    'bankTransfer-' +
    date.getFullYear() +
    '_' +
    (date.getMonth() + 1) +
    '_' +
    date.getDate();

  if (!baseUrl || !token || !tableId) {
    strapi.log.error(
      'NocoDB configuration is incomplete for bank transfer donation sync.'
    );
    throw new Error('NocoDB configuration is incomplete.');
  }

  const recordsUrl = buildRecordsApiUrl(baseUrl, tableId);
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
      await axios.post(recordsUrl, record, {
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          'xc-token': token,
        },
      });
    }
  } catch (error) {
    strapi.log.error('Failed to save captured donation to NocoDB.', error);
    throw new Error('Failed to persist donation capture.');
  }
};
