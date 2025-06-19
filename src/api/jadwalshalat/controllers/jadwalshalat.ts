/**
 * A set of functions called "actions" for `jadwalshalat`
 */

function getJadwalShalatByMonth(month) {
    return {
        status: `month ${month}`,
    };
}

function getJadwalShalatToday() {
    return {
        status: 'today',
    };
}

function getData(query) {
    if (query && query.month) {
        return getJadwalShalatByMonth(query.month);
    }

    return getJadwalShalatToday();
}

export default {
    getData: async (ctx, next) => {
        try {
            ctx.body = getData(ctx.query);
        } catch (err) {
            ctx.body = err;
            ctx.status = 500;
        }
    },
};
