export default {
    routes: [
        {
            method: 'GET',
            path: '/jadwalshalat',
            handler: 'jadwalshalat.getData',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
