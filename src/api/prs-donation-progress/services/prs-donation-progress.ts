/**
 * prs-donation-progress service
 */

import { factories } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';
import {
    FinanceCashFlowType,
    FinanceReportType,
} from '../../financereport/controllers/types';
import {
    getBalanceSummaries,
    getPRSReport,
    getDonationPackageStatistics,
} from '../../financereport/services/financereport';

const DONATION_PACKAGE_PRS_CODE = 'iwkz_prs';

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
            const donationPackageStatic = await getDonationPackageStatistics(
                DONATION_PACKAGE_PRS_CODE,
            ); // paypal real time donation for prs

            const prsCurrentBalance =
                currentBalance[FinanceReportType.PRS].lastyearIncomeBalance ||
                0;
            const donationPackageTotalPrice =
                donationPackageStatic.totalPrice || 0;

            strapi.log.info(
                JSON.stringify({
                    currentDonation,
                    prsCurrentBalance,
                    donationPackageTotalPrice,
                }),
            );

            return {
                currentDonation: parseFloat(
                    (
                        currentDonation +
                        prsCurrentBalance +
                        donationPackageTotalPrice
                    ).toFixed(2),
                ),
            };
        } catch (error) {
            strapi.log.error(
                'Failed to hydrate PRS donation progress from NocoDB',
                error,
            );
            throw error;
        }
    },
});

export default factories.createCoreService(
    'api::prs-donation-progress.prs-donation-progress',
    prsProgressService,
);
