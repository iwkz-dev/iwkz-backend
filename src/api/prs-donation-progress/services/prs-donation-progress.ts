/**
 * prs-donation-progress service
 */

import { factories } from "@strapi/strapi";
import type { Core } from "@strapi/strapi";
import {
  FinanceCashFlowType,
  FinanceReportType,
} from "../../financereport/controllers/types";
import {
  getBalanceSummaries,
  getPRSReport,
} from "../../financereport/services/financereport";

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

const prsProgressService = ({ strapi }: { strapi: Core.Strapi }) => ({
  async getPRSProgressWithCurrentDonation() {
    try {
      const currentYear = new Date().getFullYear();
      const currentDonation = await sumPRSYear(currentYear);
      const currentBalance = await getBalanceSummaries(currentYear);

      const prsCurrentBalance =
        currentBalance[FinanceReportType.PRS].lastyearIncomeBalance || 0;

      return {
        currentDonation: parseFloat(
          (currentDonation + prsCurrentBalance).toFixed(2),
        ),
      };
    } catch (error) {
      strapi.log.error(
        "Failed to hydrate PRS donation progress from NocoDB",
        error,
      );
      throw error;
    }
  },
});

export default factories.createCoreService(
  "api::prs-donation-progress.prs-donation-progress",
  prsProgressService,
);
