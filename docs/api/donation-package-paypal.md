# Donation Package PayPal API

Base URL:
- `http://<host>:<port>/api`

All examples below use JSON.

## 1. Create PayPal Order

Endpoint:
- `POST /donation-package/paypal`

Purpose:
- Accept donation items in net amount.
- Calculate PayPal gross-up fee in backend using `payment-config`.
- Create PayPal order and return approval link for frontend redirect.
- `items[].unique_code` should come from `donationPackages[].donationItems[].uniqueCode`.

Request body:

```json
{
  "total_order": 3,
  "total_price": 30,
  "items": [
    { "unique_code": "ramadan1447", "total_order": 2, "total_price": 20 },
    { "unique_code": "operational", "total_order": 1, "total_price": 10 }
  ]
}
```

Validation rules:
- `total_order` must be `> 0`.
- `total_price` must be `> 0`.
- `items` must not be empty.
- Every item requires:
- `unique_code` non-empty string.
- `total_order` number `> 0`.
- `total_price` number `> 0`.
- `description` optional string.
- Header totals must match item totals:
- `total_order === sum(items.total_order)`.
- `total_price === sum(items.total_price)`.

Success response example:

```json
{
  "data": {
    "total_order": 3,
    "total_price": 30,
    "items": [
      { "unique_code": "ramadan1447", "total_order": 2, "total_price": 20 },
      { "unique_code": "operational", "total_order": 1, "total_price": 10 }
    ],
    "paypal_order_id": "5O190127TN364715T",
    "paypal_link": "https://www.paypal.com/checkoutnow?token=5O190127TN364715T",
    "paypal_net_amount": 30,
    "paypal_fee_amount": 1.12,
    "paypal_gross_amount": 31.12
  },
  "meta": {}
}
```

Error responses:
- `400 Bad Request` for payload validation failure.
- `500 Internal Server Error` for PayPal / config / internal service failure.

## 2. Capture Approved PayPal Order

Endpoint:
- `POST /donation-package/paypal/capture`

Purpose:
- Capture approved PayPal order.
- On success, persist donation rows into NocoDB table configured by `IWKZ_NOCODB_TABLE_DONATIONPACKAGE`.

Request body:

```json
{
  "order_id": "5O190127TN364715T"
}
```

Alternative body (if frontend receives PayPal `token` param):

```json
{
  "token": "5O190127TN364715T"
}
```

Success response example:

```json
{
  "data": {
    "paypal_order_id": "5O190127TN364715T",
    "paypal_capture_id": "3GG279541U471931P",
    "paypal_status": "COMPLETED",
    "items": [
      { "unique_code": "ramadan1447", "total_order": 2, "total_price": 20 },
      { "unique_code": "operational", "total_order": 1, "total_price": 10 }
    ]
  },
  "meta": {}
}
```

Error responses:
- `400 Bad Request` when `order_id` and `token` are missing.
- `500 Internal Server Error` when capture fails or persistence to NocoDB fails.

## 3. Create Bank Transfer Donation (Admin)

Endpoint:
- `POST /donation-package/bank-transfer`

Purpose:
- Insert manual donation transaction into NocoDB for bank transfer flow.

Request body:

```json
{
  "items": [
    { "donation_code": "operational", "total_order": 1, "total_price": 100 },
    { "donation_code": "ramadan1447_iftar", "total_order": 2, "total_price": 30 }
  ]
}
```

Validation rules:
- `items` can contain one or more rows.
- For each item:
- `donation_code` is required.
- `total_order` must be `> 0`.
- `total_price` must be `> 0`.
- Backward-compatible: single item body without `items` is still accepted.

Success response example:

```json
{
  "data": {
    "items": [
      { "donation_code": "operational", "total_order": 1, "total_price": 100 },
      { "donation_code": "ramadan1447_iftar", "total_order": 2, "total_price": 30 }
    ]
  },
  "meta": {}
}
```

## PayPal Fee Handling (Implemented)

- Frontend sends `total_price` as net donation target.
- Backend reads fee config from `payment-config.paypal`:
- `fixFee` in currency units (example: `0.35` means `0.35` in current currency).
- `percentageFee` in percent (example: `2.49` means `2.49%`).
- Backend computes:
- `grossAmount = ceil((netAmount + fixedFee) / (1 - percentageRate), 2 decimals)`.
- `feeAmount = grossAmount - netAmount`.
- PayPal order uses `grossAmount`.
- PayPal order includes an additional item: `PayPal processing fee`.

## Required Environment Variables

- `PAYPAL_BASE_URL` (sandbox/prod API host)
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_CURRENCY` (default in code: `EUR`)
- `IWKZ_NOCODB_API`
- `IWKZ_NOCODB_API_TOKEN`
- `IWKZ_NOCODB_TABLE_DONATIONPACKAGE`

## Data Persistence to NocoDB

Current implementation writes pending rows at order creation and marks them completed at capture.

Pending row fields per donation item:
- `capture_id`
- `donation_code`
- `total_order`
- `total_price`
- `description`
- `is_completed` (false on create)
- `transaction_id` (empty on create)

Capture step updates rows with:
- `is_completed = 1`
- `transaction_id = <paypal capture id>`

If your NocoDB table has additional required fields, update mappings in:
- `src/api/donation-package/services/donation-package.repository.ts`
- `src/api/donation-package/services/donation-package-paypal.service.ts`
