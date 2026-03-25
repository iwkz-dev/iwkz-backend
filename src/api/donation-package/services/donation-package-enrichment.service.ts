import type { DonationPackageItem } from '../types/donation-package';
import { getDonationPackageStatistics } from '../../financereport/services/financereport';

export const enrichDonationPackages = async (
  packages: DonationPackageItem[]
): Promise<DonationPackageItem[]> => {
  return Promise.all(
    packages.map(async (pkg) => {
      if (
        !pkg.donationItems ||
        pkg.donationItems.length === 0 ||
        pkg.published === false
      ) {
        return {
          ...pkg,
          donationItems: [],
        };
      }

      const enrichedDonationItems = await Promise.all(
        pkg.donationItems.map(async (item) => {
          const donationCode = item.uniqueCode?.trim() ?? '';
          if (!donationCode) {
            return {
              ...item,
              total_order: 0,
              total_donation: 0,
            };
          }

          const donationPackageStats =
            await getDonationPackageStatistics(donationCode);

          strapi.log.info(
            '[enrichedDonationItems] ' +
              JSON.stringify({
                donationCode,
                donationPackageStats,
              })
          );

          return {
            ...item,
            total_order: donationPackageStats.totalOrder,
            total_donation: donationPackageStats.totalPrice,
          };
        })
      );

      return {
        ...pkg,
        donationItems: enrichedDonationItems,
      };
    })
  );
};
