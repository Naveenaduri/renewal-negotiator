# Renewal Negotiator

Rehearse the negotiation before you send it. Forward a renewal or vendor quote; a buyer agent and a simulated vendor-rep agent rehearse the negotiation with receipts (source link + screenshot for every price claim), then you get a verified final email.

Built for the Agent Builders Hackathon (2026-10-24).

## Stack
Next.js (App Router, TypeScript) on Vercel · Supabase (auth, Postgres, realtime) · Omnara (durable agents) · context.dev (research, scrape, screenshots)

## Setup
1. Create a Supabase project; run `supabase/schema.sql` in the SQL editor.
2. In Supabase Auth settings, enable anonymous sign-ins (so sample runs work without sign-up).
3. Copy `.env.example` to `.env.local` and fill in the keys.
4. Give `SPEC.md` to your coding agent and build stage by stage.

## Status
See SPEC.md for the full spec and build order.

## Context.dev integration (research, scrape, screenshots)
Run locally: `npm install`, then `cp .env.example .env.local` and set `CONTEXT_DEV_API_KEY`, then `npm run dev`.

All Context.dev access goes through `src/lib/context-dev.ts`, which is server-only. See `AGENTS.md` for the conventions.

- `POST /api/research {vendor, domain?, currentDeal?, maxEvidence?, fresh?}` runs three steps:
  1. **Answers** (`fast`) returns plans and alternatives, each with a cited `source_url`.
  2. **Search** finds a fallback pricing page for prices that have no cited source.
  3. **Scrape** captures a screenshot and the relevant passages for each source page. A price is marked `verified` only when its number appears on that page.
- `POST /api/evidence {url, query?, fresh?, fullPage?}` captures or re-captures one page as a receipt.

Scripts: `npm test` (unit tests, Context.dev mocked) · `npm run typecheck` · `npm run lint` · `npm run build`
