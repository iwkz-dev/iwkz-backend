/**
 * A set of functions called "actions" for `financereport`
 */

import { getPRSReport } from '../services/financereport';

const getPRSData = async (query) => {
    if (query && query.year) {
        return await getPRSReport(query.year);
    } else {
        const currentYear = new Date().getFullYear();
        return await getPRSReport(currentYear);
    }
};

export default {
    getPRSReport: async (ctx, next) => {
        try {
            ctx.body = await getPRSData(ctx.query);
        } catch (err) {
            ctx.body = err;
            ctx.status = 500;
        }
    },
};
