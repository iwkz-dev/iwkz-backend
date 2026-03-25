# Google Drive cache

Environment variables required for Google Drive caching (service account):

- GOOGLE_SERVICE_ACCOUNT_EMAIL: Service account email.
- GOOGLE_SERVICE_ACCOUNT_KEY (or GOOGLE_PRIVATE_KEY fallback): Private key string. Keep the surrounding quotes in `.env`; escape newlines as `\n` (helper also accepts `\r`).
- GOOGLE_DRIVE_CACHE_HIJRIAH_DATE: Folder ID on the shared drive where cache files are stored for hijriah data.

Notes

- File naming: `{year}-{month}.json` (e.g., `2026-03.json`).
- The cache helper uses the Drive v3 API with `supportsAllDrives` enabled; ensure the service account has access to the shared folder.
- If Drive operations fail or env vars are missing, the service logs the issue and continues without caching.
- Consider Drive rate limits when calling multiple times concurrently; cache reads are single-file lookups and writes update or create the target file in place.
