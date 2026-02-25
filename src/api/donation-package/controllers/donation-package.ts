/**
 * donation-package controller
 */

import { factories } from '@strapi/strapi';
import type {
    CapturePaypalPaymentBody,
    CreateBankTransferDonationBody,
    CreatePaypalPaymentBody,
} from '../types/donation-package';

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    if (typeof value === 'string' && value.trim() !== '') return Number(value);
    return NaN;
};

export default factories.createCoreController(
    'api::donation-package.donation-package',
    ({ strapi }) => ({
        async find(ctx) {
            const data = await strapi
                .service('api::donation-package.donation-package')
                .findWithStatus();

            return {
                data,
                meta: {},
            };
        },
        async createPaypalPayment(ctx) {
            try {
                const body = (ctx.request.body ??
                    {}) as CreatePaypalPaymentBody;
                const totalOrder = toNumber(body.total_order);
                const totalPrice = toNumber(body.total_price);
                const items = Array.isArray(body.items) ? body.items : [];

                if (!Number.isFinite(totalOrder) || totalOrder <= 0) {
                    return ctx.badRequest(
                        '`total_order` must be a number > 0.',
                    );
                }

                if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
                    return ctx.badRequest(
                        '`total_price` must be a number > 0.',
                    );
                }

                if (items.length === 0) {
                    return ctx.badRequest(
                        '`items` is required and must not be empty.',
                    );
                }

                const normalizedItems = items.map((item, index) => {
                    const uniqueCode = item.unique_code?.trim();
                    const itemTotalOrder = toNumber(item.total_order);
                    const itemTotalPrice = toNumber(item.total_price);
                    const description = item.description?.trim() || '';

                    if (!uniqueCode) {
                        throw new Error(
                            `Invalid item at index ${index}: \`unique_code\` is required.`,
                        );
                    }

                    if (
                        !Number.isFinite(itemTotalOrder) ||
                        itemTotalOrder <= 0
                    ) {
                        throw new Error(
                            `Invalid item at index ${index}: \`total_order\` must be a number > 0.`,
                        );
                    }

                    if (
                        !Number.isFinite(itemTotalPrice) ||
                        itemTotalPrice <= 0
                    ) {
                        throw new Error(
                            `Invalid item at index ${index}: \`total_price\` must be a number > 0.`,
                        );
                    }

                    return {
                        unique_code: uniqueCode,
                        total_order: itemTotalOrder,
                        total_price: itemTotalPrice,
                        description,
                    };
                });

                const totalOrderFromItems = normalizedItems.reduce(
                    (sum, item) => sum + item.total_order,
                    0,
                );
                const totalPriceFromItems = normalizedItems.reduce(
                    (sum, item) => sum + item.total_price,
                    0,
                );

                if (totalOrderFromItems !== totalOrder) {
                    return ctx.badRequest(
                        '`total_order` must match the sum of `items.total_order`.',
                    );
                }

                if (Math.abs(totalPriceFromItems - totalPrice) > 0.000001) {
                    return ctx.badRequest(
                        '`total_price` must match the sum of `items.total_price`.',
                    );
                }

                const payment = await strapi
                    .service('api::donation-package.donation-package')
                    .createPaypalPaymentLink({
                        total_order: totalOrder,
                        total_price: totalPrice,
                        items: normalizedItems,
                    });

                return {
                    data: {
                        total_order: totalOrder,
                        total_price: totalPrice,
                        items: normalizedItems,
                        paypal_order_id: payment.orderId,
                        paypal_link: payment.approvalUrl,
                        paypal_net_amount: payment.netAmount,
                        paypal_fee_amount: payment.feeAmount,
                        paypal_gross_amount: payment.grossAmount,
                    },
                    meta: {},
                };
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message.startsWith('Invalid item')
                ) {
                    return ctx.badRequest(error.message);
                }

                strapi.log.error(
                    'createPaypalPayment controller failed.',
                    error,
                );
                return ctx.internalServerError(
                    'Failed to create PayPal payment link.',
                );
            }
        },
        async capturePaypalPayment(ctx) {
            try {
                const body = (ctx.request.body ??
                    {}) as CapturePaypalPaymentBody;
                const orderId = (body.order_id ?? body.token ?? '').trim();

                if (!orderId) {
                    return ctx.badRequest('`order_id` or `token` is required.');
                }

                const capture = await strapi
                    .service('api::donation-package.donation-package')
                    .capturePaypalPayment({
                        order_id: orderId,
                    });

                return {
                    data: {
                        paypal_order_id: capture.orderId,
                        paypal_capture_id: capture.captureId,
                        paypal_status: capture.status,
                        items: capture.items,
                    },
                    meta: {},
                };
            } catch (error) {
                strapi.log.error(
                    'capturePaypalPayment controller failed.',
                    error,
                );
                return ctx.internalServerError(
                    'Failed to capture PayPal payment.',
                );
            }
        },
        async createBankTransferDonation(ctx) {
            try {
                const body = (ctx.request.body ??
                    {}) as CreateBankTransferDonationBody;
                const itemsFromBody = Array.isArray(body.items)
                    ? body.items
                    : [];

                const itemsSource =
                    itemsFromBody.length > 0
                        ? itemsFromBody
                        : [
                              {
                                  donation_code: body.donation_code,
                                  total_order: body.total_order,
                                  total_price: body.total_price,
                                  description: body.description,
                              },
                          ];

                const normalizedItems = itemsSource.map((item, index) => {
                    const donationCode = (item.donation_code ?? '').trim();
                    const totalOrder = toNumber(item.total_order);
                    const totalPrice = toNumber(item.total_price);

                    if (!donationCode) {
                        throw new Error(
                            `Invalid bank-transfer item at index ${index}: \`donation_code\` is required.`,
                        );
                    }

                    if (!Number.isFinite(totalOrder) || totalOrder <= 0) {
                        throw new Error(
                            `Invalid bank-transfer item at index ${index}: \`total_order\` must be a number > 0.`,
                        );
                    }

                    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
                        throw new Error(
                            `Invalid bank-transfer item at index ${index}: \`total_price\` must be a number > 0.`,
                        );
                    }

                    return {
                        donation_code: donationCode,
                        total_order: totalOrder,
                        total_price: totalPrice,
                        description: item.description?.trim() || '',
                    };
                });

                const savedDonation = await strapi
                    .service('api::donation-package.donation-package')
                    .createBankTransferDonation({
                        items: normalizedItems,
                    });

                return {
                    data: savedDonation,
                    meta: {},
                };
            } catch (error) {
                strapi.log.error(
                    'createBankTransferDonation controller failed.',
                    error,
                );
                if (
                    error instanceof Error &&
                    error.message.startsWith('Invalid bank-transfer item')
                ) {
                    return ctx.badRequest(error.message);
                }
                return ctx.internalServerError(
                    'Failed to create bank transfer donation.',
                );
            }
        },
    }),
);
