export default {
    routes: [
        {
            method: 'POST',
            path: '/donation-package/paypal',
            handler: 'donation-package.createPaypalPayment',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
