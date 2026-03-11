# IWKZ Backend (Strapi)

Backend CMS and API service for IWKZ, built with Strapi v5 and TypeScript.

## Tech Stack

-   Strapi `5.16.x`
-   Node.js `>=18 <=22`
-   MySQL
-   NocoDB integration
-   PayPal Checkout integration
-   Google Drive API

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy environment template:

```bash
cp .env.example .env
```

3. Fill required env values in `.env`.

4. Run development server:

```bash
npm run develop
```

Server default:

-   `http://localhost:1337`

## Main Scripts

-   `npm run dev` start dev server with auto reload
-   `npm run develop` start dev server with auto reload
-   `npm run start` start production server
-   `npm run build` build Strapi admin
-   `npm run strapi` run Strapi CLI command

## Environment Variables (Important)

Core:

-   `NODE_ENV`
-   `HOST`
-   `PORT`
-   `APP_KEYS`
-   `JWT_SECRET`
-   `API_TOKEN_SALT`
-   `ADMIN_JWT_SECRET`
-   `TRANSFER_TOKEN_SALT`
-   `ENCRYPTION_KEY`

Database:

-   `DATABASE_CLIENT`
-   `DATABASE_HOST`
-   `DATABASE_PORT`
-   `DATABASE_NAME`
-   `DATABASE_USERNAME`
-   `DATABASE_PASSWORD`

NocoDB:

-   `IWKZ_NOCODB_API`
-   `IWKZ_NOCODB_API_TOKEN`
-   `IWKZ_NOCODB_TABLE_DONATIONPACKAGE`
-   `IWKZ_NOCODB_TABLE_JADWAL_SHALAT`
-   `IWKZ_NOCODB_TABLE_JADWAL_SHALAT_LEAPDAY`
-   `IWKZ_NOCODB_TABLE_KEUANGAN_PRS`
-   `IWKZ_NOCODB_TABLE_KEUANGAN_OPERASIONAL`
-   `IWKZ_NOCODB_TABLE_KEUANGAN_SHALATJUMAT`
-   `IWKZ_NOCODB_TABLE_KEUANGAN_LEDGER`

PayPal:

-   `PAYPAL_BASE_URL`
-   `PAYPAL_CLIENT_ID`
-   `PAYPAL_CLIENT_SECRET`
-   `PAYPAL_CURRENCY`
-   `PAYPAL_WEBHOOK_VERIFICATION`

Google Drive cache:

-   `GOOGLE_SERVICE_ACCOUNT_EMAIL`
-   `GOOGLE_SERVICE_ACCOUNT_KEY` (or `GOOGLE_PRIVATE_KEY`)
-   `GOOGLE_DRIVE_CACHE_HIJRIAH_DATE` (Google Drive folder ID)

## API Documentation

Custom endpoints overview:

-   `docs/api/custom-endpoints.md`

Donation Package PayPal flow:

-   `docs/api/donation-package-paypal.md`

## Existing Custom Services

Custom business logic currently implemented in:

-   `src/api/donation-package/services/donation-package.ts`
-   `src/api/donation-package/services/donation-package-enrichment.service.ts`
-   `src/api/donation-package/services/donation-package-paypal.service.ts`
-   `src/api/donation-package/services/donation-package.repository.ts`
-   `src/api/donation-package/services/donation-package.utils.ts`
-   `src/api/jadwalshalat/services/jadwalshalat.ts`
-   `src/api/financereport/services/financereport.ts`
-   `src/helpers/googleDriveCache.ts`

Related custom routes/controllers:

-   `src/api/donation-package/routes/custom-donation-package.ts`
-   `src/api/jadwalshalat/routes/jadwalshalat.ts`
-   `src/api/financereport/routes/financereport.ts`

## Notes

-   Donation PayPal order uses gross-up calculation in backend so `total_price` from frontend is treated as net donation target.
-   PayPal capture endpoint persists donation records into NocoDB table configured by `IWKZ_NOCODB_TABLE_DONATIONPACKAGE`.
-   Donation catalog now uses `donationPackages[].donationItems` where each item provides `uniqueCode`, `price`, and `targetDonation`.
-   Donation package service has been split by responsibility:
    -   orchestration in `donation-package.ts`
    -   PayPal flow in `donation-package-paypal.service.ts`
    -   NocoDB data access in `donation-package.repository.ts`
    -   enrichment and shared utils in dedicated modules
-   Hijriah date fetching in `jadwalshalat` now uses Google Drive cache:
    -   cache key format: `{year}-{month}.json` (example: `2026-03.json`)
    -   lookup order: Drive cache first, then IslamicFinder API, then write-back to Drive
    -   if Drive env is missing, service logs warning and continues without cache
