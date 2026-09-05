# RazorPilot — AI Shopping & Payment Agent

RazorPilot understands natural-language shopping requests, searches and compares
products, prepares orders, and safely orchestrates Razorpay payments while keeping
the user in control of every financial action. Built for the Razorpay AI Buildathon 2026.

## Structure

```text
RazorPilot/
├── backend/    # Express + TypeScript + PostgreSQL + Prisma + Gemini + Razorpay (see backend/README.md)
└── frontend/   # Next.js 14 + Tailwind + TanStack Query (see frontend/README.md)
```

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env        # then fill in GEMINI_API_KEY (and Razorpay keys for live payments)
docker compose up --build
npm run seed                # demo catalog (51 products) + demo user + demo merchants

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:3000 (set NEXT_PUBLIC_API_URL in .env.local if needed)
```

Demo logins: `demo@example.com / DemoPass123` ·
merchants (`techbazaar@example.com`, `soundscape@example.com`,
`computehub@example.com`) / `MerchantPass123`.

## Docs

- Backend API contract: [`backend/docs/API_CONTRACT.md`](backend/docs/API_CONTRACT.md)

## Security note

Never commit `.env` files or real API keys. Only `*.example` files are tracked —
`.gitignore` enforces this at every level.
