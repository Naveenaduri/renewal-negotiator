# Renewal Negotiator

**Rehearse the negotiation before you send it.**

Paste a software renewal email. A Claude agent researches real public pricing, rehearses the negotiation against a simulated vendor, and drafts a counter-offer with a receipt for every price. Our own code verifies each number against its source page. Nothing is emailed until you approve, and the deal closes with a clear saving.

Built for the Agent Builders Hackathon (2026-10-24).

## How it works

1. **Research.** The agent extracts the vendor, price, seats and renewal date from your email, then pulls the vendor's public pricing and real alternatives through context.dev, with a screenshot of each page.
2. **Rehearse.** A buyer argues only from those receipts against a labeled, simulated vendor rep, for up to three rounds. A judge scores the result.
3. **Verify.** Plain code re-fetches every source URL and checks that each dollar amount in a claim appears on the page. No receipt, no claim.
4. **Approve.** You review the draft and approve it. Until then nothing leaves the app.
5. **Send and close.** Primitive emails the vendor. When the vendor replies, the app reviews the offer, accepts it and sends a win email showing the old price, the new price and the saving.

One Claude agent (Claude Sonnet 5.5) plays the extractor, researcher, buyer, vendor simulation and judge roles in turn. The verifier is code. In the demo, a person plays the vendor from the Mail desk page.

## Architecture

```
Browser (Next.js UI)
   │ start · approve · send
   ▼
Next.js 16 server (Freestyle VM) ── price verifier (code)
   │ launch run                   ▲ send / read email
   ▼                              ▼
Claude agent on Omnara        Primitive
   │ research        │ writes every step
   ▼                 ▼
context.dev       Supabase (auth · Postgres · realtime · storage)
                     │ live updates
                     ▼
                  Browser
```

A run is a background job. The server launches the agent and returns at once. The page follows progress through Supabase realtime rows, with polling as a backup.

| Part | Used for |
| --- | --- |
| Next.js 16, React 19, TypeScript, Tailwind v4, Framer Motion | UI and API routes |
| Supabase | Anonymous and magic-link sign-in, Postgres with row-level security, realtime, screenshot storage |
| Omnara | Durable background agent in its own sandbox, with pause and resume at gates |
| context.dev | Web search, scraping and screenshots (8 calls per run, cached) |
| Primitive | Sends and receives email (sign-in links, vendor email, win email) |
| Freestyle | Hosts the app on a VM |

## Run it locally

You need Node 20 or newer and accounts for Supabase, Omnara, context.dev and Primitive.

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. In Supabase Auth settings, turn on anonymous sign-ins so samples work without an account.
3. Copy `.env.example` to `.env.local` and fill in the keys (see below).
4. Install and start:

```bash
npm install
npm run dev
```

Open http://localhost:3000 and pick a sample renewal (Dropbox, Slack or Gong).

## Environment variables

Every key stays server-side except the two public Supabase values. Never commit `.env.local`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server writes and verification |
| `OMNARA_API_KEY`, `OMNARA_ORG_ID`, `OMNARA_PROJECT_ID` | Launch and manage the agent |
| `CONTEXT_DEV_API_KEY` | Research, scraping, screenshots |
| `PRIMITIVE_API_KEY`, `PRIMITIVE_FROM` | Outbound and inbound email |
| `APP_URL` | Base URL used in email links |
| `DESK_PASSCODE` | Protects the Mail desk page where a person plays the vendor |
| `DEFAULT_VENDOR_EMAIL`, `GUEST_VENDOR_ALLOW` | Optional vendor address controls |
| `FREESTYLE_API_KEY` | Only needed to deploy to a Freestyle VM |
| `ANTHROPIC_API_KEY` | Optional fallback if Omnara streaming is unavailable |

## Checks

```bash
npm test          # unit tests
npm run typecheck
npm run lint
npm run build
```

All context.dev access goes through `src/lib/context-dev.ts` (see `AGENTS.md`).

## Project layout

- `src/app`: pages (`/`, `/new`, `/run`, `/signin`, `/mail`) and API routes (`/api/runs`, `/api/auth`, `/api/desk`, `/api/health`)
- `src/lib/agent/instruction.ts`: the agent's instructions and the helper it runs in its sandbox
- `src/lib/verify.ts`: the price verifier
- `src/lib/negotiation.ts`: send, read reply, review and accept
- `src/lib/primitive.ts`, `src/lib/omnara.ts`, `src/lib/context-dev.ts`: service wrappers
- `supabase/schema.sql`: tables and row-level security
- `SPEC.md`: the original spec and build order

## Limits to know about

- The vendor is simulated. A person answers from the Mail desk, so replies are not instant.
- Primitive limits who an account can email, so vendor addresses must be ones the account is allowed to send to.
- The Mail desk shares one passcode. Set `DESK_PASSCODE` and keep it private.
- Public pricing is the source of truth. When no public price exists, the app says so and negotiates on seats, billing period and term instead of inventing a number.

## Team

Built by Naveen Aduri and yfandev.
