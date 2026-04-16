export default {
  routes: [
    {
      method: 'GET',
      path: '/financereport/prs',
      handler: 'financereport.prsDataController',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/financereport/operational',
      handler: 'financereport.operationalDataController',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/financereport/ledger',
      handler: 'financereport.ledgerDataController',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/financereport/summaries',
      handler: 'financereport.summaryDataController',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/financereport/shalat-jumat',
      handler: 'financereport.shalatJumatDataController',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/financereport/process-statement',
      handler: 'financereport.processStatement',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
