/**
 * donation-package service
 */

import { factories } from '@strapi/strapi';
import axios from 'axios';
import type { Core } from '@strapi/strapi';
import type {
    CreatePaypalPaymentInput,
    DonationPackageEntity,
    DonationPackageItem,
    DonationStats,
    NocoDonationRecord,
    NocoDonationResponse,
    PaymentConfigEntity,
    PaypalAccessTokenResponse,
    PaypalOrderResponse,
    PaypalPaymentLinkResponse,
} from '../types/donation-package';

const ZERO_STATS: DonationStats = {
    total_order: 0,
    total_donation: 0,
};

const DONATION_TABLE_ID = process.env.IWKZ_NOCODB_TABLE_DONATIONPACKAGE;
const PAYPAL_BASE_URL =
    process.env.PAYPAL_BASE_URL ?? 'https://api-m.sandbox.paypal.com';
const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY ?? 'EUR';

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
};

const roundToCurrency = (value: number): number => {
    return Math.round(value * 100) / 100;
};

const ceilToCurrency = (value: number): number => {
    return Math.ceil(value * 100) / 100;
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

const getPaypalAccessToken = async (strapi: Core.Strapi): Promise<string> => {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        strapi.log.error(
            'PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not configured.',
        );
        throw new Error('PayPal configuration is incomplete.');
    }

    try {
        const tokenUrl = `${PAYPAL_BASE_URL}/v1/oauth2/token`;
        const response = await axios.post<PaypalAccessTokenResponse>(
            tokenUrl,
            'grant_type=client_credentials',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                auth: {
                    username: clientId,
                    password: clientSecret,
                },
            },
        );

        if (!response.data?.access_token) {
            strapi.log.error(
                'PayPal token response does not include access token.',
            );
            throw new Error('PayPal authentication failed.');
        }

        return response.data.access_token;
    } catch (error) {
        strapi.log.error('Failed to get PayPal access token.', error);
        throw new Error('Unable to authenticate with PayPal.');
    }
};

const getPaypalRedirectUrls = async (
    strapi: Core.Strapi,
): Promise<{
    returnUrl: string;
    cancelUrl: string;
    fixFeeMinor: number;
    percentageFeeBps: number;
}> => {
    try {
        const paymentConfig = (await strapi.entityService.findMany(
            'api::payment-config.payment-config',
            {
                populate: {
                    paypal: true,
                },
            },
        )) as PaymentConfigEntity | null;

        const returnUrl = paymentConfig?.paypal?.returnUrl?.trim();
        const cancelUrl = paymentConfig?.paypal?.cancelUrl?.trim();
        const fixFeeMinor = toNumber(paymentConfig?.paypal?.fixFee);
        const percentageFeeBps = toNumber(paymentConfig?.paypal?.percentageFee);

        if (!returnUrl || !cancelUrl) {
            strapi.log.error(
                'PayPal redirect URL config is missing in payment-config.paypal.',
            );
            throw new Error('PayPal redirect URL is not configured.');
        }

        if (fixFeeMinor < 0 || percentageFeeBps < 0 || percentageFeeBps >= 10000) {
            strapi.log.error('Invalid PayPal fee configuration detected.', {
                fixFeeMinor,
                percentageFeeBps,
            });
            throw new Error('PayPal fee configuration is invalid.');
        }

        return { returnUrl, cancelUrl, fixFeeMinor, percentageFeeBps };
    } catch (error) {
        strapi.log.error(
            'Failed to read PayPal redirect config from payment-config.',
            error,
        );
        throw new Error('Unable to resolve PayPal redirect configuration.');
    }
};

const createPaypalOrder = async (
    strapi: Core.Strapi,
    payload: CreatePaypalPaymentInput,
): Promise<PaypalPaymentLinkResponse> => {
    const accessToken = await getPaypalAccessToken(strapi);
    const { returnUrl, cancelUrl, fixFeeMinor, percentageFeeBps } =
        await getPaypalRedirectUrls(strapi);
    const netAmount = roundToCurrency(payload.total_price);
    const fixedFee = roundToCurrency(fixFeeMinor / 100);
    const percentageFeeRate = percentageFeeBps / 10000;
    const grossAmount = ceilToCurrency(
        (netAmount + fixedFee) / (1 - percentageFeeRate),
    );
    const feeAmount = roundToCurrency(grossAmount - netAmount);

    if (grossAmount <= 0 || feeAmount < 0) {
        strapi.log.error('Invalid gross-up result for PayPal order.', {
            netAmount,
            grossAmount,
            feeAmount,
            fixFeeMinor,
            percentageFeeBps,
        });
        throw new Error('Unable to calculate PayPal gross amount.');
    }

    const description = payload.items
        .map((item) => item.unique_code)
        .join(',')
        .slice(0, 127);
    const customId = payload.items
        .map(
            (item) =>
                `${item.unique_code}:${item.total_order}:${item.total_price}`,
        )
        .join('|')
        .slice(0, 127);
    const paypalItems = payload.items.map((item) => ({
        name: `${item.unique_code} x${item.total_order}`.slice(0, 127),
        quantity: '1',
        unit_amount: {
            currency_code: PAYPAL_CURRENCY,
            value: item.total_price.toFixed(2),
        },
    }));

    if (feeAmount > 0) {
        paypalItems.push({
            name: 'PayPal processing fee',
            quantity: '1',
            unit_amount: {
                currency_code: PAYPAL_CURRENCY,
                value: feeAmount.toFixed(2),
            },
        });
    }

    const orderPayload: Record<string, unknown> = {
        intent: 'CAPTURE',
        purchase_units: [
            {
                reference_id: `donation_${Date.now()}`,
                custom_id: customId,
                description,
                amount: {
                    currency_code: PAYPAL_CURRENCY,
                    value: grossAmount.toFixed(2),
                    breakdown: {
                        item_total: {
                            currency_code: PAYPAL_CURRENCY,
                            value: grossAmount.toFixed(2),
                        },
                    },
                },
                items: paypalItems,
            },
        ],
    };

    orderPayload.application_context = {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        user_action: 'PAY_NOW',
    };

    try {
        const orderUrl = `${PAYPAL_BASE_URL}/v2/checkout/orders`;
        const response = await axios.post<PaypalOrderResponse>(
            orderUrl,
            orderPayload,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            },
        );

        const approvalUrl = response.data?.links?.find(
            (link) => link.rel === 'approve',
        )?.href;

        if (!approvalUrl || !response.data?.id) {
            strapi.log.error('PayPal order response missing approval link.', {
                orderId: response.data?.id,
            });
            throw new Error('PayPal approval link is unavailable.');
        }

        return {
            orderId: response.data.id,
            approvalUrl,
            netAmount,
            grossAmount,
            feeAmount,
        };
    } catch (error) {
        strapi.log.error('Failed to create PayPal order.', error);
        throw new Error('Unable to create PayPal payment link.');
    }
};

const donationPackageService = ({ strapi }: { strapi: Core.Strapi }) => ({
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
    async createPaypalPaymentLink(payload: CreatePaypalPaymentInput) {
        try {
            return await createPaypalOrder(strapi, payload);
        } catch (error) {
            strapi.log.error('Failed to build PayPal payment link.', error);
            throw error;
        }
    },
});

export default factories.createCoreService(
    'api::donation-package.donation-package',
    donationPackageService,
);
