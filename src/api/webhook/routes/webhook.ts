export default {
    routes: [
        {
            method: 'POST',
            path: '/webhook/paypal',
            handler: 'webhook.paypal',
            config: {
                auth: false,
                policies: [],
                middlewares: [],
            },
        },
    ],
};
