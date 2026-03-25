import type { Core } from '@strapi/strapi';
import { createHmac } from 'crypto';
import { Server, type Socket } from 'socket.io';
import { DashboardPayload } from './types/strapi-dashboard';
import { getJadwalShalatToday } from './api/jadwalshalat/services/jadwalshalat';
import {
  getDonationPackageStatistics,
  getOperationalReport,
  getPRSReport,
} from './api/financereport/services/financereport';

const DASHBOARD_EVENT =
  process.env.IWKZ_SOCKET_DASHBOARD_EVENT || 'iwkz_dashboard';
const DONATION_PACKAGE_DONASIOPERASIONAL = 'donasi_operasional';
const API_TOKEN_LAST_USED_WINDOW_MS = 60 * 60 * 1000;
const PRS_DONATION_PROGRESS_SERVICE_UID =
  'api::prs-donation-progress.prs-donation-progress';

type PrsDonationProgressService = {
  getPRSProgressWithCurrentDonation: () => Promise<unknown>;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const extractToken = (socket: Socket) => {
  const authToken =
    typeof socket.handshake.auth?.token === 'string'
      ? socket.handshake.auth.token
      : null;
  const authorizationHeader = Array.isArray(
    socket.handshake.headers.authorization
  )
    ? socket.handshake.headers.authorization[0]
    : socket.handshake.headers.authorization;
  const rawToken = authToken || authorizationHeader;

  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  return rawToken.replace(/^Bearer\s+/i, '').trim();
};

const getApiTokenSalt = (strapi: Core.Strapi) =>
  strapi.config.get<string | undefined>('admin.apiToken.salt') ||
  process.env.API_TOKEN_SALT;

const hashApiToken = (token: string, salt: string) =>
  createHmac('sha512', salt).update(token).digest('hex');

const isTokenExpired = (expiresAt?: string | Date | null) => {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() < Date.now();
};

const shouldRefreshLastUsedAt = (lastUsedAt?: string | Date | null) => {
  if (!lastUsedAt) {
    return true;
  }

  return (
    Date.now() - new Date(lastUsedAt).getTime() >= API_TOKEN_LAST_USED_WINDOW_MS
  );
};

const findValidApiToken = async (strapi: Core.Strapi, token: string) => {
  const salt = getApiTokenSalt(strapi);

  if (!salt) {
    throw new Error('Missing admin.apiToken.salt configuration');
  }

  const hashedToken = hashApiToken(token, salt);
  const apiToken = await strapi.db.query('admin::api-token').findOne({
    select: ['id', 'name', 'type', 'expiresAt', 'lastUsedAt'],
    where: {
      accessKey: hashedToken,
    },
  });

  if (!apiToken || isTokenExpired(apiToken.expiresAt)) {
    return null;
  }

  if (shouldRefreshLastUsedAt(apiToken.lastUsedAt)) {
    await strapi.db.query('admin::api-token').update({
      where: {
        id: apiToken.id,
      },
      data: {
        lastUsedAt: new Date(),
      },
    });
  }

  return apiToken;
};

const getSettledValue = <T>(
  strapi: Core.Strapi,
  label: string,
  result: PromiseSettledResult<T>
) => {
  if (result.status === 'fulfilled') {
    return result.value;
  }

  strapi.log.error(
    `[dashboard] ${label} failed during aggregation: ${getErrorMessage(
      result.reason
    )}`
  );

  return null;
};

const authenticateSocket = async (
  strapi: Core.Strapi,
  socket: Socket,
  next: (error?: Error) => void
) => {
  const token = extractToken(socket);

  if (!token) {
    next(new Error('Authentication error: No token provided'));
    return;
  }

  try {
    const apiToken = await findValidApiToken(strapi, token);

    if (!apiToken) {
      strapi.log.warn('[socket.io] API token verification failed');
      next(new Error('Authentication error: Invalid token'));
      return;
    }

    socket.data.apiTokenId = apiToken.id;
    socket.data.apiTokenName = apiToken.name;
    next();
  } catch (error) {
    strapi.log.warn(
      `[socket.io] API token verification failed: ${getErrorMessage(error)}`
    );
    next(new Error('Authentication error: Invalid token'));
  }
};

const createDashboardPayload = async (
  strapi: Core.Strapi
): Promise<DashboardPayload> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const prsDonationProgressService = strapi.service(
    PRS_DONATION_PROGRESS_SERVICE_UID as never
  ) as PrsDonationProgressService;
  const [
    jadwalShalat,
    currentOperationalDonationProgress,
    prsReport,
    operationalReport,
    currentPrsDonationProgress,
  ] = await Promise.allSettled([
    getJadwalShalatToday(),
    getDonationPackageStatistics(DONATION_PACKAGE_DONASIOPERASIONAL, {
      year,
      month,
    }),
    getPRSReport(year),
    getOperationalReport(year),
    prsDonationProgressService.getPRSProgressWithCurrentDonation(),
  ]);

  return {
    todayJadwalShalat: getSettledValue(strapi, 'Jadwal Shalat', jadwalShalat),
    finance: {
      currentOperationalDonationProgress:
        getSettledValue(
          strapi,
          'Finance - Current Operational Donation Progress',
          currentOperationalDonationProgress
        ) ?? {},
      currentPrsDonationProgress: getSettledValue(
        strapi,
        'Finance - Current PRS Donation Progress',
        currentPrsDonationProgress
      ),
      prsMonthlyReport: getSettledValue(
        strapi,
        'Finance - PRS Report',
        prsReport
      ),
      operationalMonthlyReport: getSettledValue(
        strapi,
        'Finance - Operational',
        operationalReport
      ),
    },
    lastUpdated: new Date().toISOString(),
  };
};

const initializeSocketServer = (strapi: Core.Strapi) => {
  if (!strapi.server?.httpServer) {
    strapi.log.error(
      '[socket.io] Initialization skipped because `strapi.server.httpServer` is unavailable.'
    );
    return;
  }

  strapi.io = new Server(strapi.server.httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  strapi.io.use((socket, next) => {
    void authenticateSocket(strapi, socket, next);
  });

  strapi.io.on('connection', (socket) => {
    strapi.log.info(
      `[socket.io] Client connected: ${socket.id}. apiTokenId=${socket.data.apiTokenId ?? 'unknown'}`
    );

    socket.on('disconnect', (reason) => {
      strapi.log.info(
        `[socket.io] Client disconnected: ${socket.id}. reason=${reason}`
      );
    });
  });

  strapi.log.info('[socket.io] Server initialized successfully.');
};

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    initializeSocketServer(strapi);

    strapi.broadcastDashboardData = async () => {
      const payload = await createDashboardPayload(strapi);

      if (strapi.io) {
        strapi.io.emit(DASHBOARD_EVENT, payload);
      }

      return payload;
    };

    strapi.log.info(
      '[dashboard] Global broadcaster registered as `strapi.broadcastDashboardData()`.'
    );
  },
};
