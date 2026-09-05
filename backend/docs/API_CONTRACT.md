# RazorPilot API Contract

Base URL: `http://localhost:5000/api/v1` (configurable via `API_PREFIX`).

## Envelope

Every success response includes `success: true` plus the legacy payload keys
(collections expose items under `data`). Every error response:

```json
{ "success": false, "error": { "code": "CART_EMPTY", "message": "...", "details": {}, "request_id": "req_..." } }
```

No stack traces, secrets, or raw DB errors are ever returned.

## Error codes

`VALIDATION_ERROR` · `AUTHENTICATION_ERROR` (`401`, bad/missing JWT) ·
`AUTHORIZATION_ERROR` (`403`, suspended) · `NOT_FOUND` ·
`PRODUCT_OUT_OF_STOCK` (`409`) · `CART_EMPTY` (`400`) ·
`ORDER_ALREADY_PAID` (`409`) · `PRICE_CHANGED` (`409`, fresh preview in
`error.details.preview`) · `INVALID_WEBHOOK_SIGNATURE` (`401`) ·
`PROVIDER_ERROR` (`502`, retryable) · `CONFLICT` · `INTERNAL_ERROR`.

## Auth — cookie `rp_token` (httpOnly, Secure in prod) or `Authorization: Bearer`

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | no (strict RL) | `{name, email, password≥8}` | `201 {user, token}` | `CONFLICT` duplicate |
| POST | `/auth/login` | no (strict RL) | `{email, password}` | `200 {user, token}` | `AUTHENTICATION_ERROR`, `AUTHORIZATION_ERROR` suspended |
| POST | `/auth/logout` | no | — | `{status:"ok"}`, clears cookie | — |
| GET | `/auth/me` | yes | — | `{user}` | `AUTHENTICATION_ERROR` |

## Products (public)

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/products` | `category` slug, `merchant` uuid, `minPrice`, `maxPrice`, `availability`=`in_stock`/`out_of_stock`, `sort`=`newest`/`price_asc`/`price_desc`, `page`, `pageSize≤50` | `{data: ProductCard[], pagination}` |
| GET | `/products/search` | same + required `q` | same |
| GET | `/products/:id` | — | `{product}` (`404` unknown or `INACTIVE`, `400` malformed id) |
| GET | `/categories` | — | `{data: [{id,name,slug,productCount}]}` |

`ProductCard`: `{id, name, slug, description, price (major unit), currency,
stockQuantity, status, stockStatus (in_stock/low_stock≤5/out_of_stock),
quantityAvailable, attributes, keyFeatures (derived, never fabricated),
imageUrl, imageUrls, category, merchant}`.

## Cart (auth, owner-isolated)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/cart` | — | `{cart}` (auto-created) | `401` |
| POST | `/cart/items` | `{productId, quantity 1–999}` — extra keys (e.g. `unitPrice`) ignored | `{cart}` with `pricing{...}` | `404` unknown, `PRODUCT_OUT_OF_STOCK`, `400` qty |
| PATCH | `/cart/items/:id` | `{quantity}` | `{cart}` (price re-snapshotted) | `404` (+ cross-user), `PRODUCT_OUT_OF_STOCK` |
| DELETE | `/cart/items/:id` | — | `{cart}` | `404` |
| DELETE | `/cart` | — | `{cart}` emptied | — |

## Orders (auth, owner-isolated)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| POST | `/orders/preview` | `{expectedTotal?}` | flat totals + `pricing{}` + `securityChecks{priceVerified,stockVerified,totalVerified,userConfirmationRequired}` + `requiresUserConfirmation:true` | `CART_EMPTY`, `PRODUCT_OUT_OF_STOCK`, `PRICE_CHANGED` (stale total, fresh preview in `details`) |
| POST | `/orders` | `Idempotency-Key?` | `201 {order: PENDING_PAYMENT}` / `200` replay | `CART_EMPTY`, `PRODUCT_OUT_OF_STOCK` (atomic rollback) |
| GET | `/orders` | `?page&pageSize&status` | `{data: OrderListItem[], pagination}` (`itemCount,total,previewImageUrl`) | — |
| GET | `/orders/:id` | — | `{order}` with `pricing`, `payment` summary, `timeline[]` | `404` (+ cross-user), `400` id |

`timeline` is backend-derived (`ORDER_CREATED → PAYMENT_INITIATED →
PAYMENT_VERIFIED → ORDER_CONFIRMED → PROCESSING → SHIPPED → DELIVERED`, plus
`PAYMENT_FAILED`/`CANCELLED` branches) — the frontend renders it, never hardcodes progress.

## Payments (auth except webhook; strict rate limits)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| POST | `/payments/create` | `{orderId}`, `Idempotency-Key?` | `201 {payment, checkout:{keyId,razorpayKeyId,providerOrderId,razorpayOrderId,amount,amountRupees,amountPaise,currency,orderId,orderNumber,paymentStatus,requiresUserConfirmation}}` — amount always = order total | `404`, `ORDER_ALREADY_PAID`, `409` wrong state |
| POST | `/payments/verify` | `{providerOrderId,providerPaymentId,signature}` | `{success, order, payment, status: PAID\|FAILED\|PENDING, message}` — only a valid provider signature moves state | `401` bad signature, `404`, `409` settled |
| GET | `/payments/:id` | — | `{payment}` | `404` (+ cross-user) |
| POST | `/webhooks/razorpay` | provider HMAC (`x-razorpay-signature` over raw body) | `{received:true, deduped, processed, orderStatus}` — repeats are no-ops | `INVALID_WEBHOOK_SIGNATURE` |

## Agent (auth, owner-isolated, strict rate limits)| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/agent/sessions` | `{context?}` | `201 {session}` |
| GET | `/agent/sessions` | — | `{data: [{id,status,messageCount,...}]}` latest-first |
| GET | `/agent/sessions/:id` | — | `{session, messages, toolCalls}` |
| GET | `/agent/sessions/:id/messages` | — | `{data: messages[]}` |
| GET | `/agent/sessions/:id/activity` | — | `{data: AgentActivity[]}` — human labels, never raw tool names |
| POST | `/agent/sessions/:id/messages` | `{message 1–2000, confirmed?}` | `AgentResponse` (below; `ai_unavailable:true` on provider outage, zero side effects) |

`AgentResponse`: `{sessionId, messageId, message, type (text |
product_recommendation | product_comparison | cart_update | order_preview |
payment_ready | payment_result | error), products?, recommendation? {productId,
reason, matchedPreferences, tradeoffs, alternatives}, activities?, actions?
(add_to_cart/view_product/buy_product/checkout…), cart?, order?,
securityChecks?, metadata?}` — plus legacy `session_id`, `message`, `tool_calls`.

Registered tools (locked set): `search_products`, `get_product`,
`compare_products` (`PUBLIC_READ`); `get_user_preferences`, `get_cart`,
`preview_order` (`USER_AUTHENTICATED`); `add_to_cart`, `remove_from_cart`,
`create_order` (`USER_INTENT_REQUIRED`); `prepare_payment`
(`USER_CONFIRMATION_REQUIRED`, needs `confirmed:true`). No `execute_payment`
tool exists by design.

## Analytics (auth)

`GET /analytics/overview|orders|payments|agent` — order/payment revenue and
status breakdowns, agent sessions, tool-call success/blocked counts, per-tool stats.
`GET /analytics/merchant` (merchant JWT) — same shapes scoped to the merchant's orders.

## Merchants (merchant JWT with `role:"merchant"`, `rp_merchant_token` cookie)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| POST | `/merchants/register` | `{name, email, password≥8}` | `201 {merchant, token}` | `CONFLICT` duplicate |
| POST | `/merchants/login` | `{email, password}` | `200 {merchant, token}` (no hash leak) | `401`, `403` suspended |
| POST | `/merchants/logout` | — | `{status:"ok"}` | — |
| GET | `/merchants/me` | — | `{merchant}` | `401` (user tokens rejected) |
| GET | `/merchants/me/products` | — | `{data: products[]}` (own catalog) | — |
| POST | `/merchants/me/products` | `{name, price>0, stockQuantity≥0, categoryId?, status?, attributes?, imageUrl?}` | `201 {product}` | `400` validation |
| PATCH | `/merchants/me/products/:id` | partial fields (≥1) | `{product}` | `404` (+ cross-merchant) |
| GET | `/merchants/me/orders` | `?page&pageSize&status` | paginated own orders with items | — |
| GET | `/merchants/me/orders/:id` | — | `{order}` full DTO + timeline | `404` (+ cross-merchant) |
| PATCH | `/merchants/me/orders/:id/status` | `{status: PROCESSING\|SHIPPED\|DELIVERED\|CANCELLED}` | `{order}` | `409` illegal jump/terminal |

Demo merchant logins (seeded): `techbazaar@example.com`,
`soundscape@example.com`, `computehub@example.com` — all with password
`MerchantPass123`.

## Fulfillment & cancellation

State machine: `PAID → PROCESSING → SHIPPED → DELIVERED`, plus `→ CANCELLED`
from `PAID`/`PROCESSING` (merchant) and from `PENDING_PAYMENT`/`PAYMENT_FAILED`
(shopper via `PATCH /orders/:id/status {status:"CANCELLED"}`). Anything else →
`409`. Cancellations restore reserved stock atomically and write
`ORDER_STATUS_CHANGED` audits. The order `timeline` derives progression from
persisted status (reached = completed, next = current).

## Refunds

`POST /payments/:id/refund` (owner): only `CAPTURED` payments on
`PAID`/`PROCESSING` orders. Issues the provider refund (paise-correct),
marks payment `REFUNDED` (+ `providerRefundId`), cancels the order, restores
stock, writes `PAYMENT_REFUNDED` + `ORDER_STATUS_CHANGED`. Repeat refund →
`409`; foreign payment → `404`.

## Health

`GET /health` → `{status:"healthy"}` · `GET /health/db` → live `SELECT 1`
(`503` when unreachable).

## Money units

DB/cart/order APIs: major units as JSON numbers (`4999` = ₹4,999).
Razorpay boundary: paise integers (`amountPaise: 499900`). Never floats for
authoritative math; `Decimal(14,2)` in PostgreSQL.

## Security behavior (applies everywhere)

Backend is authoritative for prices, stock, totals, payment/order status, and
identity. Owners
...[truncated 615 chars]