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

## Development
`npm install` · `cp .env.example .env.local` (fill in keys) · `npm run dev`

Checks: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`. All Context.dev access goes through `src/lib/context-dev.ts` (see `AGENTS.md`).
