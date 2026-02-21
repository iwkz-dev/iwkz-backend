/**
 * donation-package controller
 */

import { factories } from '@strapi/strapi';
export default factories.createCoreController(
    'api::donation-package.donation-package',
    ({ strapi }) => ({
        async find(ctx) {
            const data = await strapi
                .service('api::donation-package.donation-package')
                .findWithStatus();

            return {
                data,
                meta: {},
            };
        },
    }),
);
