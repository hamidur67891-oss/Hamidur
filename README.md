# NearLoop

**Shop Local. Discover Nearby.**

NearLoop is a mobile-first Indian local-shopping marketplace. Customers browse only verified, Premium-active shops in an exact six-digit PIN code, then contact shop owners directly by WhatsApp or in-app chat. There is no checkout, delivery, or order-management flow.

## What is included

- React, TypeScript, Vite, Tailwind CSS, Express, PostgreSQL, and Drizzle ORM.
- Clerk-managed account registration and sign-in; NearLoop roles and profiles are stored in PostgreSQL.
- Exact-PIN shop/product discovery, shop and product details, customer profiles, notifications, help, and direct contact.
- Seller application/review flow, approved-seller product management, availability, photo uploads, and basic shop analytics.
- Admin-only shop/seller/product/complaint/billing/category/PIN management APIs and dashboard.
- PostgreSQL conversations, messages, read markers, and unread counts.
- Premium subscriptions and payment history, with server-side test-payment verification in development only.
- Drizzle schema and initial SQL migration, plus starter category seed data.

## Replit setup

The project already has a PostgreSQL database, Clerk authentication, and App Storage configured for this workspace. Keep their values in Replit Secrets; do not add secrets to source control.

### Required settings

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Use Replit's provisioned database. |
| `CLERK_PUBLISHABLE_KEY` | Server-side Clerk configuration, managed through Replit Auth. |
| `CLERK_SECRET_KEY` | Server-side Clerk configuration, managed through Replit Auth. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk key embedded into the web build. |
| `ADMIN_EMAILS` | Comma-separated allowlist of verified admin emails. Set this in Replit Secrets; users cannot grant themselves admin access. |
| `PREMIUM_PRICE_INR` | Optional monthly Premium price in rupees; defaults to `15`. |
| `PAYMENT_MODE` | Development only: unset or `test` enables a clearly labelled simulation. Production never accepts simulated payments. |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` | App Storage settings provisioned by Replit. Make sure they are available to the production deployment too. |

The existing NearLoop web and API workflows set their ports and routes. In Replit, start the `artifacts/nearloop: web` and `artifacts/api-server: API Server` workflows. The web artifact is served at `/`; the API is mounted at `/api`.

For a local development process, use the workspace's required port/base-path variables:

```sh
PORT=8080 pnpm --filter @workspace/api-server run dev
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/nearloop run dev
```

The API process also requires `DATABASE_URL` and the Clerk Secrets above.

## Database setup

Install workspace packages and apply the generated migration to a **new, empty** PostgreSQL database:

```sh
pnpm install
pnpm --filter @workspace/db run migrate
pnpm --filter @workspace/db run seed
```

The seed adds starter categories only. It intentionally does not create fabricated sellers, shops, products, payment records, PIN codes, or customer accounts. An allowlisted admin should add the PIN codes the marketplace actually supports, then review real seller applications. Shop PINs are verified as part of that admin review.

This workspace's development database has already had its schema synchronized and starter categories seeded. Do not run the initial migration against that existing database: it is an initial-create migration, not a migration-history baseline. For development schema synchronization use:

```sh
pnpm --filter @workspace/db run push
```

For later schema changes, generate and review a migration before applying it:

```sh
pnpm --filter @workspace/db run generate
pnpm --filter @workspace/db run migrate
```

Use `migrate` only when the target database has the prior migration history. Do not use `push-force` against a database containing data.

## First-use checklist

1. In Replit Secrets, set `ADMIN_EMAILS` to the exact verified email address that will administer the marketplace.
2. Sign in with that email. Add the real service PIN codes and review the active category list in the admin panel.
3. Sellers sign in, submit their shop application, and wait for review. Pending sellers cannot manage products.
4. Approve only shops whose submitted details and service PIN have been checked. Shop owners can then add listings and upload product photos.
5. In development, the Premium screen clearly labels its server-verified simulation; no money moves. A real payment provider and verified webhook are not configured in this project yet.

## Security and visibility

- Public listings require an approved shop, verified active PIN, active owner account, visible product, and an unexpired active Premium subscription. PIN search is exact-match only.
- Clerk identity is verified on the server. Admin access comes only from the `ADMIN_EMAILS` allowlist.
- Seller routes check approval and ownership on the backend. Chat history and send operations check conversation participation.
- Product uploads require an approved seller, are limited to JPEG/PNG/WebP/AVIF up to 5 MB, and are checked for image signatures before being made public. Unattached uploads remain private to their seller.
- Premium test tokens are short-lived, stored only as hashes, and safe to retry. A fake or expired token cannot activate Premium; production has no payment gateway configured and will not report a successful real payment.
- Customer phone/profile fields are private by default. A shop's verified WhatsApp contact is shown on its own public listing for direct contact.

## Validation

Run the workspace checks:

```sh
pnpm run typecheck
PORT=18141 BASE_PATH=/ pnpm --filter @workspace/nearloop run build
pnpm --filter @workspace/api-server run build
```

The app has no synthetic marketplace records by default, so discovery starts empty until real PINs and approved, Premium-active shops are entered. Full customer/seller/admin workflows require signing into test accounts through Clerk; do not treat unauthenticated API checks as proof of those signed-in workflows.

## Publishing

Publish the NearLoop web artifact and API Server artifact together so the `/` web route and `/api` service are deployed in sync. Replit publishes all artifacts in the project together. Before the first publish:

1. Confirm development categories and supported PINs are configured.
2. In Publishing settings, add the required production deployment secrets, including Clerk keys, `ADMIN_EMAILS`, `PREMIUM_PRICE_INR`, and App Storage settings.
3. Confirm the production database has the migrations and seed data before serving traffic. The development database is the source used to provision production data, so seed it first.
4. Keep `PAYMENT_MODE` unset in production until a real gateway integration with server-side callback verification is implemented. Do not turn on test simulation in production.

Publishing geography is chosen in Replit Publishing settings before the first publish. Replit locks that choice for the deployment.
