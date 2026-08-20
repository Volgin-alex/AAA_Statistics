# Market Lane

Full-stack demo internet shop for OpenAI Sites/vinext.

## Features

- Product catalog with cards, prices, stock, ratings, and images.
- Customer registration and login with HttpOnly cookie sessions.
- Persistent D1-backed cart per customer.
- Checkout flow that stores order snapshots and clears the cart.
- Order history in the customer profile.
- AppMetrica integration through `NEXT_PUBLIC_APPMETRICA_ID`.

## Prerequisites

- Node.js `>=22.13.0`

## Local Setup

```bash
npm install
npm run db:generate
npm run dev
```

Build validation:

```bash
npm run build
```

## Analytics

Create `.env` from `.env.example` and set:

```bash
NEXT_PUBLIC_APPMETRICA_ID=your_counter_id
```

The app sends registration, login, logout, add-to-cart, and purchase events. It
also pushes ecommerce payloads to `dataLayer` and calls `window.AppMetrica` when
the shop is opened inside an environment that exposes the AppMetrica bridge.

## Persistence

`.openai/hosting.json` declares the D1 binding as `DB`. Schema lives in
`db/schema.ts`; the initial SQL migration is stored in `drizzle/`.
