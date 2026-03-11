# Custom API Endpoints

Base URL:
- `http://<host>:<port>/api`

This project contains several custom routes in addition to default Strapi CRUD routes.

## Donation Package

Source:
- `src/api/donation-package/routes/donation-package.ts` (core route)
- `src/api/donation-package/routes/custom-donation-package.ts`

Endpoints:
- `GET /donation-package` (customized payload from service)
- `POST /donation-package/paypal`
- `POST /donation-package/paypal/capture`
- `POST /donation-package/bank-transfer`

Detailed docs:
- `docs/api/donation-package-paypal.md`

Behavior:
- `GET /donation-package` returns package-level information.
- Donation options now live in `donationPackages[].donationItems`.
- Donation stats are attached per `donationItems[].uniqueCode` as `total_order` and `total_donation`.
- `POST /donation-package/bank-transfer` stores manual bank transfer donation rows to NocoDB.
- `POST /donation-package/bank-transfer` supports both `items[]` and backward-compatible single item payload.

## Jadwal Shalat

Source:
- `src/api/jadwalshalat/routes/jadwalshalat.ts`

Endpoint:
- `GET /jadwalshalat`

Query params:
- Optional `month`
- Optional `year`

Behavior:
- If `month` and `year` are provided, returns schedule for that month/year.
- Otherwise returns today's schedule.
- Hijriah date lookup uses Google Drive read-through cache (see `docs/google-drive-cache.md`).

## Finance Report

Source:
- `src/api/financereport/routes/financereport.ts`

Endpoints:
- `GET /financereport/prs`
- `GET /financereport/operational`
- `GET /financereport/ledger`
- `GET /financereport/summaries`

Query params:
- `prs`, `operational`, `summaries` support optional `year`.
- `ledger` does not require query params.

## Notes

- This list includes custom routes plus the core `GET /donation-package` route used by the custom controller/service behavior.
- Default Strapi routes for content types remain available unless restricted by permissions/policies.
