import type { Core } from '@strapi/strapi';

export const publishDashboardUpdate = async (
  strapi: Core.Strapi
): Promise<void> => {
  if (!strapi.broadcastDashboardData) {
    strapi.log.warn(
      '[dashboard] Broadcast skipped because `strapi.broadcastDashboardData()` is not registered.'
    );
    return;
  }

  await strapi.broadcastDashboardData();
};

export const triggerDashboardUpdate = (strapi: Core.Strapi): void => {
  void publishDashboardUpdate(strapi).catch((error) => {
    strapi.log.error('Failed to broadcast dashboard data', error);
  });
};
