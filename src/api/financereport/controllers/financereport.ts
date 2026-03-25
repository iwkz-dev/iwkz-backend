/**
 * A set of functions called "actions" for `financereport`
 */

import {
  getPRSReport,
  getOperationalReport,
  getLedger,
  getBalanceSummaries,
} from '../services/financereport';
import { createStatementProcessor } from '../services/statement-processor';

const DOCUMENT_DATE_REGEX = /^\d{2}\.\d{2}\.\d{4}$/;
const TRANSACTION_DATE_REGEX = /^\d{2}-\d{2}-\d{4}$/;
const VALID_STATUSES = new Set(['income', 'outcome']);

const createValidationError = (message: string) => {
  const error = new Error(message) as Error & { status?: number };
  error.status = 400;
  return error;
};

const normalizeTransaction = (transaction: any, index: number) => {
  if (!transaction || typeof transaction !== 'object') {
    throw createValidationError(
      `data[${index}] must be an object with date, amount, status, and description.`
    );
  }

  const date =
    typeof transaction.date === 'string' ? transaction.date.trim() : '';
  const description =
    typeof transaction.description === 'string'
      ? transaction.description.trim()
      : '';
  const status =
    typeof transaction.status === 'string'
      ? transaction.status.trim().toLowerCase()
      : '';
  const amount = Number(transaction.amount);

  if (!TRANSACTION_DATE_REGEX.test(date)) {
    throw createValidationError(
      `data[${index}].date must use DD-MM-YYYY format.`
    );
  }

  if (!Number.isFinite(amount)) {
    throw createValidationError(
      `data[${index}].amount must be a valid number.`
    );
  }

  if (!VALID_STATUSES.has(status)) {
    throw createValidationError(
      `data[${index}].status must be either "income" or "outcome".`
    );
  }

  if (!description) {
    throw createValidationError(
      `data[${index}].description must be a non-empty string.`
    );
  }

  return {
    date,
    amount,
    status,
    description,
  };
};

const normalizePayload = (body: any) => {
  if (!body || typeof body !== 'object') {
    throw createValidationError('Request body must be a JSON object.');
  }

  const date = typeof body.date === 'string' ? body.date.trim() : '';
  if (!DOCUMENT_DATE_REGEX.test(date)) {
    throw createValidationError('`date` must use DD.MM.YYYY format.');
  }

  if (!Array.isArray(body.data)) {
    throw createValidationError('`data` must be an array.');
  }

  const documentType =
    typeof body.document_type === 'string'
      ? body.document_type.trim().toLowerCase()
      : '';

  return {
    date,
    document_type: documentType,
    data: body.data.map(normalizeTransaction),
  };
};

const getPRSData = async (query) => {
  if (query && query.year) {
    return await getPRSReport(query.year);
  } else {
    const currentYear = new Date().getFullYear();
    return await getPRSReport(currentYear);
  }
};

const getOperationalData = async (query) => {
  if (query && query.year) {
    return await getOperationalReport(query.year);
  } else {
    const currentYear = new Date().getFullYear();
    return await getOperationalReport(currentYear);
  }
};

const getBalanceSummariesData = async (query) => {
  if (query && query.year) {
    return await getBalanceSummaries(query.year);
  } else {
    const currentYear = new Date().getFullYear();
    return await getBalanceSummaries(currentYear);
  }
};

export default {
  prsDataController: async (ctx, next) => {
    try {
      ctx.body = await getPRSData(ctx.query);
    } catch (err) {
      ctx.body = err;
      ctx.status = 500;
    }
  },
  operationalDataController: async (ctx, next) => {
    try {
      ctx.body = await getOperationalData(ctx.query);
    } catch (err) {
      ctx.body = err;
      ctx.status = 500;
    }
  },
  ledgerDataController: async (ctx, next) => {
    try {
      ctx.body = await getLedger();
    } catch (err) {
      ctx.body = err;
      ctx.status = 500;
    }
  },
  summaryDataController: async (ctx, next) => {
    try {
      ctx.body = await getBalanceSummariesData(ctx.query);
    } catch (err) {
      ctx.body = err;
      ctx.status = 500;
    }
  },
  processStatement: async (ctx, next) => {
    try {
      strapi.log.info(
        `[financereport.processStatement] Incoming request. bodyKeys=${Object.keys(
          ctx.request.body ?? {}
        ).join(',')}`
      );
      const payload = normalizePayload(ctx.request.body ?? {});
      strapi.log.info(
        `[financereport.processStatement] Payload validated. document_date=${payload.date}, document_type=${payload.document_type || 'n/a'}, transaction_count=${payload.data.length}`
      );

      const statementProcessor = createStatementProcessor({ strapi });
      strapi.log.info(
        `[financereport.processStatement] Statement processor resolved. hasProcessStatement=${typeof statementProcessor?.processStatement === 'function'}`
      );

      ctx.body = await statementProcessor.processStatement(payload);
      strapi.log.info(
        `[financereport.processStatement] Statement processed successfully. response_transactions=${ctx.body?.transactions?.length ?? 0}`
      );
    } catch (err) {
      if (err?.status === 400) {
        strapi.log.warn(
          `[financereport.processStatement] Validation failed: ${err.message}`
        );
        ctx.body = {
          data: null,
          error: {
            status: 400,
            name: 'ValidationError',
            message: err.message,
          },
        };
        ctx.status = 400;
        return;
      }

      strapi.log.error('Failed to process finance statement payload.', err);
      ctx.body = {
        data: null,
        error: {
          status: 500,
          name: 'InternalServerError',
          message: 'Failed to process statement data.',
        },
      };
      ctx.status = 500;
    }
  },
};
