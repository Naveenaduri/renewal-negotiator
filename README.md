# Renewal Negotiator

Next.js (App Router, TypeScript) app for Vercel. AI research finds a vendor's public pricing and its alternatives. Each price comes with a **source URL and a screenshot**, all powered by [Context.dev](https://docs.context.dev).

## Setup
```bash
npm install
cp .env.example .env.local   # then set CONTEXT_DEV_API_KEY
npm run dev                  # http://localhost:3000
```
Deploy on Vercel: `vercel env add CONTEXT_DEV_API_KEY`, then deploy.

## How it works
`POST /api/research {vendor, domain?, currentDeal?, maxEvidence?, fresh?}` runs three steps:
1. **Answers** (`fast`) returns plans and alternatives, each with a cited `source_url`.
2. **Search** finds a fallback pricing page for prices that have no cited source.
3. **Scrape** captures a screenshot and the relevant passages for each unique source URL. A price is marked `verified` when its number appears in the page passages.

`POST /api/evidence {url, query?, fresh?, fullPage?}` captures or re-captures one page.

All Context.dev access goes through `src/lib/context-dev.ts`. See `AGENTS.md` for the conventions.

## Scripts
`npm test` (unit tests, wrapper mocked) · `npm run typecheck` · `npm run lint` · `npm run build`
