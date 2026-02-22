export interface DonationSubpackage {
    uniqueCode?: string;
    [key: string]: unknown;
}

export interface DonationPackageItem {
    code?: string;
    uniqueCode?: string;
    subpackage?: DonationSubpackage[] | null;
    [key: string]: unknown;
}

export interface DonationPackageEntity {
    donationPackages?: DonationPackageItem[];
    [key: string]: unknown;
}

export interface DonationStats {
    total_order: number;
    total_donation: number;
}

export interface NocoDonationRecord {
    donation_code?: string;
    total_order?: number | string;
    total_price?: number | string;
}

export interface NocoDonationResponse {
    list?: NocoDonationRecord[];
}

export class PaypalPaymentItemInput {
    unique_code!: string;
    total_order!: number;
    total_price!: number;
}

export class CreatePaypalPaymentInput {
    total_order!: number;
    total_price!: number;
    items!: PaypalPaymentItemInput[];
}

export class CreatePaypalPaymentBody {
    total_order?: number | string;
    total_price?: number | string;
    items?: Array<{
        unique_code?: string;
        total_order?: number | string;
        total_price?: number | string;
    }>;
}

export interface PaypalAccessTokenResponse {
    access_token: string;
}

export interface PaypalOrderResponse {
    id: string;
    links?: Array<{
        rel?: string;
        href?: string;
    }>;
}

export class PaypalPaymentLinkResponse {
    orderId!: string;
    approvalUrl!: string;
}

export interface PaypalConfigEntity {
    returnUrl?: string;
    cancelUrl?: string;
    [key: string]: unknown;
}

export interface PaymentConfigEntity {
    paypal?: PaypalConfigEntity | null;
    [key: string]: unknown;
}
