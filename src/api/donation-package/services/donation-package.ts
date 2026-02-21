/**
 * donation-package service
 */

import { factories } from '@strapi/strapi';
import axios from 'axios';
import type { Core } from '@strapi/strapi';

type DonationSubpackage = {
    uniqueCode?: string;
    [key: string]: unknown;
};

type DonationPackageItem = {
    code?: string;
    uniqueCode?: string;
    subpackage?: DonationSubpackage[] | null;
    [key: string]: unknown;
};

type DonationPackageEntity = {
    donationPackages?: DonationPackageItem[];
    [key: string]: unknown;
};

type DonationStats = {
    total_order: number;
    total_donation: number;
};

type NocoDonationRecord = {
    donation_code?: string;
    total_order?: number | string;
    total_price?: number | string;
};

type NocoDonationResponse = {
    list?: NocoDonationRecord[];
};

const ZERO_STATS: DonationStats = {
    total_order: 0,
    total_donation: 0,
};

const DONATION_TABLE_ID = process.env.IWKZ_NOCODB_TABLE_DONATIONPACKAGE;

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
};

const buildStatsMap = (
    records: NocoDonationRecord[],
): Map<string, DonationStats> => {
    const statsMap = new Map<string, DonationStats>();

    records.forEach((record) => {
        const donationCode = record.donation_code?.trim();
        if (!donationCode) return;

        const currentStats = statsMap.get(donationCode) ?? ZERO_STATS;
        statsMap.set(donationCode, {
            total_order:
                currentStats.total_order + toNumber(record.total_order),
            total_donation:
                currentStats.total_donation + toNumber(record.total_price),
        });
    });

    return statsMap;
};

const enrichDonationPackages = (
    packages: DonationPackageItem[],
    statsMap: Map<string, DonationStats>,
): DonationPackageItem[] => {
    return packages.map((pkg) => {
        if (!pkg.subpackage || pkg.subpackage.length === 0) {
            const stats = statsMap.get(pkg.uniqueCode ?? '') ?? ZERO_STATS;

            return {
                ...pkg,
                total_order: stats.total_order,
                total_donation: stats.total_donation,
            };
        }

        const enrichedSubpackages = pkg.subpackage.map((sub) => {
            const donationCode = `${pkg.uniqueCode ?? ''}_${sub.uniqueCode ?? ''}`;
            const stats = statsMap.get(donationCode) ?? ZERO_STATS;

            return {
                ...sub,
                total_order: stats.total_order,
                total_donation: stats.total_donation,
            };
        });

        return {
            ...pkg,
            subpackage: enrichedSubpackages,
        };
    });
};

const fetchDonationStats = async (
    strapi: Core.Strapi,
): Promise<Map<string, DonationStats>> => {
    const nocoBaseUrl = process.env.IWKZ_NOCODB_API;
    const nocoToken = process.env.IWKZ_NOCODB_API_TOKEN;

    if (!nocoBaseUrl || !nocoToken) {
        strapi.log.warn(
            'Donation stats skipped: IWKZ_NOCODB_API or IWKZ_NOCODB_API_TOKEN is not configured.',
        );
        return new Map<string, DonationStats>();
    }

    const apiUrl = `${nocoBaseUrl}/tables/${DONATION_TABLE_ID}/records`;

    try {
        const response = await axios.get<NocoDonationResponse>(apiUrl, {
            headers: {
                accept: 'application/json',
                'xc-token': nocoToken,
            },
        });

        const records = response.data?.list ?? [];
        return buildStatsMap(records);
    } catch (error) {
        strapi.log.error('Failed to fetch donation stats from NocoDB.', error);
        return new Map<string, DonationStats>();
    }
};

export default factories.createCoreService(
    'api::donation-package.donation-package',
    ({ strapi }) => ({
        async findWithStatus() {
            try {
                const entity = (await strapi.entityService.findMany(
                    'api::donation-package.donation-package',
                    {
                        populate: {
                            donationPackages: {
                                populate: {
                                    image: true,
                                    subpackage: true,
                                },
                            },
                        },
                    },
                )) as DonationPackageEntity | null;

                if (!entity) {
                    strapi.log.warn(
                        'Donation package single type is empty or not found.',
                    );
                    return null;
                }

                const statsMap = await fetchDonationStats(strapi);
                const enrichedPackages = enrichDonationPackages(
                    entity.donationPackages ?? [],
                    statsMap,
                );

                return {
                    ...entity,
                    donationPackages: enrichedPackages,
                };
            } catch (error) {
                strapi.log.error(
                    'Failed to build donation package response.',
                    error,
                );
                throw error;
            }
        },
    }),
);
