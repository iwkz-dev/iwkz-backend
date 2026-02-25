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
        {
            method: 'POST',
            path: '/donation-package/paypal/capture',
            handler: 'donation-package.capturePaypalPayment',
            config: {
                policies: [],
                middlewares: [],
            },
        },
        {
            method: 'POST',
            path: '/donation-package/bank-transfer',
            handler: 'donation-package.createBankTransferDonation',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
