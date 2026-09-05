# RazorPilot Backend

Modular monolith: Express + TypeScript + PostgreSQL + Prisma + Gemini + Razorpay.
AI reasons and orchestrates through permission-gated tools; pricing, payments,
and verification stay under backend/user control.

## Verify

```bash
npm run lint     # eslint, zero warnings
npm run build    # tsc
npm test         # vitest: 153 tests / 22 files (unit + API + security + contracts)
```

Full endpoint/error/security contract: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).
Response rules: every success carries `success: true`; every error carries
`success: false` + machine-readable `error.code`. Money: JSON APIs use major
units (₹), Razorpay boundary uses paise (`amountPaise`).

All 20 critical cases from the architecture spec are covered: register/login,
cross-user cart isolation, search, in-stock add, out-of-stock block,
authoritative pricing, AI-cannot-change-price, AI-cannot-touch-Razorpay,
confirmation-gated payment prep, signature rejection, webhook dedup,
PAID/FAILED transitions, graceful AI failure, invalid tool args, blocked tools,
order + payment idempotency, health.

## Run

All backend commands run from this `backend/` folder:

```bash
cp .env.example .env
docker compose up --build
```

Local dev (needs Postgres on localhost:5433):

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run seed   # idempotent demo marketplace (51 products + demo user)
npm run dev
```

Demo user: `demo@example.com` / `DemoPass123` (budget ₹5,000, wireless-first preferences).
Demo merchants: `techbazaar@example.com`, `soundscape@example.com`,
`computehub@example.com` — all with password `MerchantPass123`.

## Health

```text
GET /api/v1/health
GET /api/v1/health/db
```

## Products (public)

```text
GET /api/v1/products?category=headphones&minPrice=1000&maxPrice=5000&merchant=<uuid>&availability=in_stock&page=1&pageSize=20
GET /api/v1/products/search?q=wireless+headphones&maxPrice=5000
GET /api/v1/products/:id
GET /api/v1/categories
```

## Cart (authenticated)

```text
GET    /api/v1/cart
POST   /api/v1/cart/items        {productId, quantity}
PATCH  /api/v1/cart/items/:id    {quantity}
DELETE /api/v1/cart/items/:id
DELETE /api/v1/cart
```

## Orders (authenticated)

Pricing is always computed from current DB prices. Free shipping ≥ ₹500, else ₹49.

```text
POST /api/v1/orders/preview   → {items, subtotal, shipping, discount, total}
POST /api/v1/orders           → 201 {order: PENDING_PAYMENT} (Idempotency-Key header supported)
GET  /api/v1/orders
GET  /api/v1/orders/:id
```

## Payments (authenticated, except webhooks)

`PAYMENT_PROVIDER=simulator` (default, deterministic demo) or `razorpay`
(requires `RAZORPAY_KEY_ID/SECRET`; webhooks need `RAZORPAY_WEBHOOK_SECRET`).

```text
POST /api/v1/payments/create  {orderId} → 201 {payment, checkout:{keyId,providerOrderId,amount}}
POST /api/v1/payments/verify  {providerOrderId,providerPaymentId,signature}
GET  /api/v1/payments/:id
POST /api/v1/webhooks/razorpay  (provider HMAC signature, event_id dedup)
```

## Agent (authenticated)

Requires `GEMINI_API_KEY` (else messages degrade gracefully with
`ai_unavailable: true` and no side effects). Tool permissions:
`PUBLIC_READ` / `USER_AUTHENTICATED` / `USER_INTENT_REQUIRED` /
`USER_CONFIRMATION_REQUIRED` (`confirmed: true`) / `SYSTEM_ONLY` (never via agent).

```text
POST /api/v1/agent/sessions                          → 201 {session}
GET  /api/v1/agent/sessions/:id                      → {session, messages, toolCalls}
POST /api/v1/agent/sessions/:id/messages  {message, confirmed?}
```

Registered tools: `search_products`, `get_product`, `compare_products`,
`get_user_preferences` (all read-only); `add_to_cart`, `remove_from_cart`,
`preview_order`, `create_order` (intent-gated); `prepare_payment`
(requires `confirmed: true`, returns Razorpay checkout data).

Safety guarantees (all covered by `tests/api/safety.test.ts`):

```text
Prices: attacker-supplied unitPrice/totals ignored at cart → preview →
        order → payment layers; the DB price always wins.
Tools: exactly 9 registered tools with locked permission levels; every
       denied attempt writes a TOOL_BLOCKED audit row.
Consent: confirmed payment prep is recorded in session context.
Injection: tool output is framed as untrusted data for the model and the
           system prompt forbids following instructions inside it.
Secrets: password hashes never leave the backend in any response.
```

## Analytics (authenticated)

```text
GET /api/v1/analytics/overview  → {orders, payments, agent} summary
GET /api/v1/analytics/orders    → {totalOrders, paidOrders, failedPayments, totalRevenue, averageOrderValue, byStatus}
GET /api/v1/analytics/payments  → {capturedPayments, failedPayments, capturedAmount, byStatus}
GET /api/v1/analytics/agent     → {agentSessions, toolCalls, successful/blockedToolCalls, callsByTool}
```

Simulator scenarios (`PAYMENT_PROVIDER=simulator`): `pay_ok_*` → SUCCESS,
`pay_fail_*` → FAILURE, `pay_timeout_*` → TIMEOUT (502, states stay open for retry).
