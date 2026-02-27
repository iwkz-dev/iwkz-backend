/**
 * prs-donation-progress controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::prs-donation-progress.prs-donation-progress",
  ({ strapi }) => ({
    async find(ctx) {
      const { data, meta } = await super.find(ctx);

      if (!data) return { data, meta };

      try {
        const prsData = await strapi
          .service("api::prs-donation-progress.prs-donation-progress")
          .getPRSProgressWithCurrentDonation();

        data.currentDonation = prsData.currentDonation;
      } catch (error) {
        strapi.log.error(
          "Failed to enhance PRS donation progress response",
          error,
        );
      }

      return { data, meta };
    },
  }),
);
