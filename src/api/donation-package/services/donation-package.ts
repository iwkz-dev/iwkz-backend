/**
 * donation-package service
 */

import { factories } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';
import type {
  CapturePaypalPaymentInput,
  CreateBankTransferDonationInput,
  CreatePaypalPaymentInput,
  DonationPackageEntity,
} from '../types/donation-package';
import { enrichDonationPackages } from './donation-package-enrichment.service';
import {
  capturePaypalOrder,
  createPaypalOrder,
} from './donation-package-paypal.service';
import { saveBankTransferDonationToNocoDB } from './donation-package.repository';

const donationPackageService = ({ strapi }: { strapi: Core.Strapi }) => ({
  async findWithStatus() {
    try {
      const entity = (await strapi.entityService.findMany(
        'api::donation-package.donation-package',
        {
          populate: {
            image: true,
            donationPackages: {
              populate: {
                image: true,
                donationItems: true,
              },
            },
          },
        }
      )) as DonationPackageEntity | null;

      if (!entity) {
        strapi.log.warn('Donation package single type is empty or not found.');
        return null;
      }

      const enrichedPackages = await enrichDonationPackages(
        entity.donationPackages ?? []
      );

      return {
        ...entity,
        donationPackages: enrichedPackages,
      };
    } catch (error) {
      strapi.log.error('Failed to build donation package response.', error);
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
  async capturePaypalPayment(payload: CapturePaypalPaymentInput) {
    try {
      return await capturePaypalOrder(strapi, payload);
    } catch (error) {
      strapi.log.error('Failed to handle PayPal capture.', error);
      throw error;
    }
  },
  async createBankTransferDonation(payload: CreateBankTransferDonationInput) {
    try {
      await saveBankTransferDonationToNocoDB(strapi, payload);
      return {
        items: payload.items,
      };
    } catch (error) {
      strapi.log.error(
        'Failed to handle bank transfer donation creation.',
        error
      );
      throw error;
    }
  },
});

export default factories.createCoreService(
  'api::donation-package.donation-package',
  donationPackageService
);
