/**
 * A set of functions called "actions" for `jadwalshalat`
 */

import {
    getJadwalShalatByMonthAndYear,
    getJadwalShalatToday,
} from '../services/jadwalshalat';

async function getData(query) {
    if (query && query.month && query.year) {
        return await getJadwalShalatByMonthAndYear(query.month, query.year);
    }

    return getJadwalShalatToday();
}

export default {
    getData: async (ctx, next) => {
        try {
            ctx.body = await getData(ctx.query);
        } catch (err) {
            ctx.body = err;
            ctx.status = 500;
        }
    },
};
