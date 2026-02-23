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
- Header totals must match item totals:
- `total_order === sum(items.total_order)`
- `total_price === sum(items.total_price)`

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

## PayPal Fee Handling (Implemented)

- Frontend sends `total_price` as net donation target.
- Backend reads fee config from `payment-config.paypal`:
- `fixFee` (minor unit, example: `35` = `0.35`).
- `percentageFee` (basis points, example: `249` = `2.49%`).
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

Current implementation inserts one row per donation item with fields:
- `capture_id`
- `donation_code`
- `total_order`
- `total_price`

If your NocoDB table has additional required fields, update the mapping in:
- `src/api/donation-package/services/donation-package.ts`
