/**
 * A set of functions called "actions" for `financereport`
 */

import {
    getPRSReport,
    getOperationalReport,
    getLedger,
    getBalanceSummaries,
} from '../services/financereport';

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
};
