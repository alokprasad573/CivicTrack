# CivicTrack — Environment Variables & Local Setup

This is the canonical source for environment variable names and ownership. Copy templates into local env files and replace placeholders. Never commit populated `.env` files.

## 1. Environment file locations

| File | Runtime | Contents |
|---|---|---|
| `apps/web/.env.local` | Next.js | Browser-safe config + Clerk server key required by Clerk Next.js SDK |
| `apps/server/.env` | Express | MongoDB, AWS, Clerk backend/webhook, Ola OAuth credentials |
| `apps/web/.env.example` | Template | Empty placeholders only |
| `apps/server/.env.example` | Template | Empty placeholders only |

## 2. Express API — `apps/server/.env`

```dotenv
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:3000

ATLAS_URI=mongodb+srv://<db_user>:<db_password>@<cluster-host>/<database>?retryWrites=true&w=majority

CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_ME
CLERK_SECRET_KEY=sk_test_REPLACE_ME
CLERK_WEBHOOK_SIGNING_SECRET=whsec_REPLACE_ME

AWS_ACCESS_KEY_ID=REPLACE_ME
AWS_SECRET_ACCESS_KEY=REPLACE_ME
AWS_REGION=ap-south-2
AWS_S3_BUCKET_NAME=civictrack-s3-bucket

OLA_MAP_PROJECT_ID=REPLACE_ME
OLA_MAPS_API_KEY=REPLACE_ME
OLA_MAP_CLIENT_ID=REPLACE_ME
OLA_MAP_CLIENT_SECRET=REPLACE_ME
```

- `NODE_ENV`: `development`, `test`, or `production`.
- `PORT`: Express port; local default `4000`; hosting platforms may inject it.
- `CLIENT_URL`: exact frontend origin for CORS and Clerk authorized-party checks, e.g. `http://localhost:3000`. For multiple origins, introduce a validated allowlist; never reflect arbitrary request origins.
- `ATLAS_URI`: MongoDB Atlas connection URI. URL-encode special characters in credentials; server-only.
- `CLERK_PUBLISHABLE_KEY`: Clerk publishable key for backend SDK configuration where required.
- `CLERK_SECRET_KEY`: Clerk secret key; server-only.
- `CLERK_WEBHOOK_SIGNING_SECRET`: Clerk webhook signing secret; verify every webhook signature and make event handling idempotent.
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: local development credentials only; use least privilege. Prefer workload IAM roles/temporary credentials in production.
- `AWS_REGION`: must match the actual bucket region. `ap-south-2` is a sample, not an assumption.
- `AWS_S3_BUCKET_NAME`: private bucket name.
- `OLA_MAP_PROJECT_ID`: Ola Maps project identifier.
- `OLA_MAPS_API_KEY`: API key for backend API-key-authenticated requests, if used. Browser SDK uses a separate `NEXT_PUBLIC_OLA_MAPS_API_KEY` setting below.
- `OLA_MAP_CLIENT_ID` / `OLA_MAP_CLIENT_SECRET`: OAuth client credentials for server-side token acquisition. The secret and access token must never reach browser code.

## 3. Next.js web — `apps/web/.env.local`

```dotenv
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_ME
CLERK_SECRET_KEY=sk_test_REPLACE_ME

NEXT_PUBLIC_OLA_MAPS_API_KEY=REPLACE_WITH_DOMAIN_RESTRICTED_KEY
NEXT_PUBLIC_OLA_MAP_PROJECT_ID=REPLACE_ME
```

Only `NEXT_PUBLIC_*` variables are exposed to browser code. Clerk secret key is server-only, even though it is present in the web app environment for Clerk's server-side SDK. Never put `ATLAS_URI`, AWS credentials, `CLERK_WEBHOOK_SIGNING_SECRET`, or `OLA_MAP_CLIENT_SECRET` in the web environment. If maps are proxied entirely through the backend, omit the two public Ola variables.

## 4. Clerk setup

1. Create a Clerk application and copy its development Publishable Key and Secret Key.
2. Configure sign-in methods and redirect URLs for `http://localhost:3000`.
3. Add a webhook endpoint at the API route actually implemented, e.g. `http://localhost:4000/api/v1/webhooks/clerk`.
4. Subscribe to the identity events handled by the application (`user.created`, `user.updated`, and `user.deleted` if deletion sync is implemented).
5. Copy the endpoint Signing Secret to `CLERK_WEBHOOK_SIGNING_SECRET`.
6. Verify signatures and handle retries idempotently.
7. Use separate production keys and webhook signing secret in production.

Official Clerk docs: [Next.js quickstart](https://clerk.com/docs/getting-started/quickstart), [Express quickstart](https://clerk.com/docs/expressjs/getting-started/quickstart), [webhook synchronization](https://clerk.com/docs/guides/development/webhooks/syncing).

## 5. AWS S3 setup

1. Create a private bucket in the intended region; keep Block Public Access enabled.
2. Create a dedicated least-privilege IAM identity restricted to this bucket and required operations.
3. Put local credentials only in `apps/server/.env`; prefer IAM roles/temporary credentials in production.
4. Use short-lived pre-signed URLs and store object keys/metadata in MongoDB, not permanent public URLs.
5. Configure bucket CORS for exact local/production origins and only required methods/headers.

## 6. MongoDB Atlas setup

1. Create a cluster and database user.
2. Restrict network access to development/hosting egress IPs where practical; avoid permanent `0.0.0.0/0` in production.
3. Copy the connection URI to `ATLAS_URI`; URL-encode special characters.
4. Grant only the database permissions CivicTrack needs.
5. Create and verify indexes, including the complaint location `2dsphere` index.

## 7. Ola Maps setup and credential handling

Ola Maps supports API-key and OAuth 2.0 authentication. Its Web SDK is initialized with an API key; OAuth uses a client ID and client secret to obtain a bearer access token for API requests.

- Create credentials in the Ola Maps/Krutrim Cloud developer portal.
- Add frontend domains to the credential's allowed-domain list where supported.
- Expose only the browser SDK API key as `NEXT_PUBLIC_OLA_MAPS_API_KEY`; restrict it by domain and monitor quotas.
- Use OAuth client credentials for server-side API calls when appropriate. Express obtains and caches short-lived access tokens.
- Never send `OLA_MAP_CLIENT_SECRET` or OAuth access tokens to the browser.
- Do not treat project ID, API key, client ID, and client secret as interchangeable.
- Isolate all provider calls behind `modules/maps/ola-maps.adapter.ts`, with timeouts, response validation, and rate-limit handling.
- Confirm current plan entitlements and supported endpoints before enabling a feature.

Official Ola Maps docs: [Authentication](https://maps.olakrutrim.com/docs/auth), [Web SDK setup](https://maps.olakrutrim.com/docs/sdks/web-sdk/latest/setup), [API reference](https://maps.olakrutrim.com/apidocs).

## 8. `.gitignore`

```gitignore
node_modules/
.next/
dist/
build/
coverage/
.env
.env.*
!.env.example
!.env.*.example
apps/web/.env.local
apps/server/.env
*.log
.DS_Store
```

## 9. Startup validation

Validate environment variables at process startup using Zod. Fail fast with the missing variable name but never print secret values. Make Ola/S3 credentials optional in tests or deployments where the corresponding integration is disabled. Do not require unused integrations just to boot the API.

## 10. Production deployment mapping

| Service | Variables |
|---|---|
| Vercel (web) | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_OLA_MAPS_API_KEY`, `NEXT_PUBLIC_OLA_MAP_PROJECT_ID` |
| Render (API) | `NODE_ENV`, `PORT` (platform supplied), `CLIENT_URL`, `ATLAS_URI`, Clerk keys, AWS settings, Ola server settings |

Use separate development, preview/staging, and production credentials. Never reuse development keys in production.
