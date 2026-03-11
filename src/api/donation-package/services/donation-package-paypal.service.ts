import axios from 'axios';
import type { Core } from '@strapi/strapi';
import type {
    CapturePaypalPaymentInput,
    CreatePaypalPaymentInput,
    PaymentConfigEntity,
    PaypalAccessTokenResponse,
    PaypalCaptureOrderResponse,
    PaypalOrderResponse,
    PaypalPaymentLinkResponse,
} from '../types/donation-package';
import {
    ceilToCurrency,
    generateDonationCaptureId,
    parseDescriptionsFromPaypal,
    parseItemsFromCustomId,
    roundToCurrency,
    toNumber,
} from './donation-package.utils';
import {
    fetchDonationItemsFromNocoDB,
    markDonationCaptureCompletedInNocoDB,
    savePendingDonationToNocoDB,
    type DonationCaptureItem,
} from './donation-package.repository';

const PAYPAL_BASE_URL =
    process.env.PAYPAL_BASE_URL ?? 'https://api-m.sandbox.paypal.com';
const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY ?? 'EUR';

type PaypalRedirectConfig = {
    returnUrl: string;
    cancelUrl: string;
    fixFeeMinor: number;
    percentageFeeBps: number;
};

export type CapturePaypalOrderResult = {
    orderId: string;
    captureId: string;
    status: string;
    items: DonationCaptureItem[];
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
): Promise<PaypalRedirectConfig> => {
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

        const fixFeeAmount = toNumber(paymentConfig?.paypal?.fixFee);
        const percentageFee = toNumber(paymentConfig?.paypal?.percentageFee);

        const fixFeeMinor = Math.round(fixFeeAmount * 100);
        const percentageFeeBps = Math.round(percentageFee * 100);

        if (!returnUrl || !cancelUrl) {
            strapi.log.error(
                'PayPal redirect URL config is missing in payment-config.paypal.',
            );
            throw new Error('PayPal redirect URL is not configured.');
        }

        if (
            fixFeeMinor < 0 ||
            percentageFeeBps < 0 ||
            percentageFeeBps >= 10000
        ) {
            strapi.log.error('Invalid PayPal fee configuration detected.', {
                fixFeeAmount,
                percentageFee,
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

export const createPaypalOrder = async (
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

    const donationCaptureId = generateDonationCaptureId();
    const descriptionMap = payload.items.reduce(
        (acc, item) => {
            const code = item.unique_code?.trim();
            if (!code) return acc;

            const desc = item.description?.trim();
            if (!acc[code]) acc[code] = [];
            if (desc) acc[code].push(desc);
            return acc;
        },
        {} as Record<string, string[]>,
    );

    const description = Object.entries(descriptionMap)
        .map(([code, descriptions]) => `${code}[${descriptions.join(',')}]`)
        .join(',');

    const customId = donationCaptureId;
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

        await savePendingDonationToNocoDB(strapi, donationCaptureId, payload.items);

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

export const capturePaypalOrder = async (
    strapi: Core.Strapi,
    payload: CapturePaypalPaymentInput,
): Promise<CapturePaypalOrderResult> => {
    const accessToken = await getPaypalAccessToken(strapi);
    const captureUrl = `${PAYPAL_BASE_URL}/v2/checkout/orders/${payload.order_id}/capture`;

    try {
        const response = await axios.post<PaypalCaptureOrderResponse>(
            captureUrl,
            {},
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            },
        );

        const orderId = response.data?.id ?? payload.order_id;
        const captureStatus = response.data?.status ?? '';
        const firstPurchaseUnit = response.data?.purchase_units?.[0];
        const capture = firstPurchaseUnit?.payments?.captures?.[0];
        const finalStatus = capture?.status ?? captureStatus;
        const paypalTransactionId = capture?.id ?? '';
        const donationCaptureId =
            capture?.custom_id ?? firstPurchaseUnit?.custom_id ?? '';
        const descriptionMap = parseDescriptionsFromPaypal(
            firstPurchaseUnit?.description,
        );

        let items = await fetchDonationItemsFromNocoDB(strapi, donationCaptureId);
        if (items.length === 0) {
            items = parseItemsFromCustomId(donationCaptureId);
        }

        const itemsWithDescription = items.map((item) => ({
            ...item,
            description:
                (item.description ?? '').trim() ||
                descriptionMap.get(item.unique_code)?.join(',') ||
                '',
        }));

        if (finalStatus !== 'COMPLETED') {
            strapi.log.warn('PayPal capture is not completed.', {
                orderId,
                status: finalStatus,
            });
            throw new Error('PayPal capture is not completed.');
        }

        if (!paypalTransactionId) {
            strapi.log.error('PayPal capture response missing capture id.', {
                orderId,
            });
            throw new Error('PayPal capture id is missing.');
        }

        if (!donationCaptureId) {
            strapi.log.error('PayPal capture response missing custom id.', {
                orderId,
            });
            throw new Error('PayPal donation capture id is missing.');
        }

        if (itemsWithDescription.length === 0) {
            strapi.log.error('No donation items found in PayPal custom_id.', {
                orderId,
                captureCustomId: donationCaptureId,
            });
            throw new Error('No donation items found for this payment.');
        }

        await markDonationCaptureCompletedInNocoDB(
            strapi,
            donationCaptureId,
            paypalTransactionId,
        );

        return {
            orderId,
            captureId: paypalTransactionId,
            status: finalStatus,
            items: itemsWithDescription,
        };
    } catch (error) {
        strapi.log.error('Failed to capture PayPal order.', error);
        throw new Error('Unable to capture PayPal payment.');
    }
};
