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
    {
      method: 'POST',
      path: '/webhook/publish-dashboard-update',
      handler: 'webhook.publishDashboardUpdate',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
