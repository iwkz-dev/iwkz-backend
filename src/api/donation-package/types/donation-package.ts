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
    netAmount!: number;
    grossAmount!: number;
    feeAmount!: number;
}

export class CapturePaypalPaymentBody {
    order_id?: string;
    token?: string;
}

export class CapturePaypalPaymentInput {
    order_id!: string;
}

export interface PaypalCapture {
    id?: string;
    status?: string;
    amount?: {
        value?: string;
        currency_code?: string;
    };
}

export interface PaypalCaptureOrderResponse {
    id?: string;
    status?: string;
    purchase_units?: Array<{
        custom_id?: string;
        payments?: {
            captures?: PaypalCapture[];
        };
    }>;
}

export interface PaypalConfigEntity {
    returnUrl?: string;
    cancelUrl?: string;
    fixFee?: number | string;
    percentageFee?: number | string;
    [key: string]: unknown;
}

export interface PaymentConfigEntity {
    paypal?: PaypalConfigEntity | null;
    [key: string]: unknown;
}
