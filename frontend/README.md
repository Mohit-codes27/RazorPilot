# RazorPilot Frontend

Next.js 14 + TypeScript + Tailwind + TanStack Query. AI-first commerce UI for the Razorpay AI Buildathon 2026.

## Setup

```bash
npm install
cp .env.local.example .env.local   # if present; otherwise create with NEXT_PUBLIC_API_URL
npm run dev                        # http://localhost:3000
```

Requires the backend (`../backend`) running — see its README. Key env:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

## Verify

```bash
npm run lint
npx tsc --noEmit
npm run build
npm start
```

## Routes

`/` landing · `/login` · `/register` · `/chat` · `/chat/[sessionId]` ·
`/discover` · `/products/[id]` · `/cart` · `/checkout` · `/checkout/success` ·
`/checkout/failed` · `/orders` · `/orders/[id]` · `/settings`

## Notes

- Auth uses backend httpOnly cookies (`credentials: include`); guarded pages redirect to login.
- All prices/totals/statuses render backend state — nothing is hardcoded.
- Razorpay key + order id + paise amount come from `POST /payments/create`; the secret never touches the frontend.
- Product images fall back to category gradient placeholders when the demo CDN URL is unreachable.
- Demo logins: `demo@example.com / DemoPass123`.
