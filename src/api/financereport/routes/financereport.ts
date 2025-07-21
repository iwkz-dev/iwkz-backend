export default {
    routes: [
        {
            method: 'GET',
            path: '/financereport/prs',
            handler: 'financereport.getPRSReport',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
