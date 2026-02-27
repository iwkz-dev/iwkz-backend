/**
 * prs-donation-progress controller
 */

import { factories } from "@strapi/strapi";
import { FinanceCashFlowType } from "../../financereport/controllers/types";
import { getPRSReport } from "../../financereport/services/financereport";

const sumPRSYear = async (year: number): Promise<number> => {
  const prsReport = await getPRSReport(year);
  const monthlyData = prsReport?.monthlyData ?? [];

  return monthlyData.reduce((yearTotal, month) => {
    const inflowTotals =
      month?.[FinanceCashFlowType.INFLOW]?.ledgerData?.reduce(
        (sum, ledger) => sum + (ledger.total || 0),
        0,
      ) ?? 0;

    const outflowTotals =
      month?.[FinanceCashFlowType.OUTFLOW]?.ledgerData?.reduce(
        (sum, ledger) => sum + (ledger.total || 0),
        0,
      ) ?? 0;

    return yearTotal + inflowTotals + outflowTotals; // outflows already negative
  }, 0);
};

export default factories.createCoreController(
  "api::prs-donation-progress.prs-donation-progress",
  ({ strapi }) => ({
    async find(ctx) {
      let finalPRS;

      try {
        const currentYear = new Date().getFullYear();
        const currentDonation = await sumPRSYear(currentYear);

        const prs = await strapi
          .documents("api::prs-donation-progress.prs-donation-progress")
          .findFirst();

        finalPRS = await strapi
          .documents("api::prs-donation-progress.prs-donation-progress")
          .update({
            documentId: prs?.documentId,
            data: { currentDonation: currentDonation },
          });

        console.log("updatedPRS", finalPRS);
      } catch (error) {
        strapi.log.error(
          "Failed to hydrate PRS donation progress from NocoDB",
          error,
        );
      }

      return finalPRS;
    },
  }),
);
