import type { Server } from 'socket.io';

export type DashboardPayload = {
  todayJadwalShalat: unknown | null;
  finance: {
    currentOperationalDonationProgress: Record<string, unknown | null>;
    currentPrsDonationProgress: unknown | null;
    prsMonthlyReport: unknown | null;
    operationalMonthlyReport: unknown | null;
  };
  lastUpdated: string;
};

declare module '@strapi/types/dist/core/strapi' {
  interface Strapi {
    io?: Server;
    broadcastDashboardData?: () => Promise<DashboardPayload>;
  }
}
