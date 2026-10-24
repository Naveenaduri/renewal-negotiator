# Spec (Prompt 0)

You are building "Renewal Negotiator" in one day for a hackathon. Judges score:
(1) production-ready: a stranger can use it with no help and it holds up,
(2) agentic use: agents do multi-step, autonomous work,
(3) creativity.
Reliability beats features. Keep a working version deployed at all times.

PRODUCT
Small teams auto-renew software they never review. The user pastes or picks a
renewal/vendor-quote email. Agents research real public pricing and alternatives,
then REHEARSE the negotiation: a buyer agent vs a simulated vendor-rep agent for up
to 3 rounds. The user gets a final email draft, with a receipt (source link +
screenshot) for every price claim, and a verification badge.

STACK
- Next.js (App Router, TypeScript) deployed on Vercel Hobby.
- Supabase: auth (email magic link), Postgres, realtime for the live log.
- Agents run on Omnara Cloud (durable agents, event streaming, tool approval).
  FIRST read Omnara's docs/repo (github.com/omnara-ai/omnara, app.omnara.com) and
  summarize how to launch an agent, stream events, and gate a tool behind approval.
  If one agent run is not streaming events into the app within 60 minutes, fall back
  to calling the Anthropic API directly from a server route and tell me.
- Research via context.dev (docs.context.dev/agent-quickstart; MCP server:
  https://mcp.context.dev/mcp): Answers/Search for alternatives, Scrape for pricing
  pages, screenshots for receipts.
- All keys in environment variables, server-side only. No keys in the repo.

AGENTS (all tool-calling)
1. Extractor: email -> JSON {vendor, product, current_price, billing_period, seats,
   renewal_date, contact}.
2. Researcher: finds the vendor's public pricing plus 2-3 real alternatives; every
   price must come from a fetched page and be saved as a receipt {claim, source_url,
   screenshot_url, fetched_at}.
3. Buyer: drafts the opening email using ONLY receipts.
4. Vendor rep (SIMULATION, always labeled): replies as a realistic account rep,
   grounded only in the vendor's scraped public pricing/terms plus generic
   negotiation moves. It must never invent a specific discount policy.
5. Verifier: checks each claim in the final draft against its receipt; removes or
   flags anything unverified. Shows "N of M claims verified".
6. Judge: ends the rehearsal; outputs final email, likely outcome, and the one
   counter the user is most likely to face with a prepared response.
If no public price is found, say "no verified pricing found" and negotiate on other
grounds (annual billing, fewer seats, term length). NEVER invent a price.

DATA (Supabase)
deals(id, user_id, vendor, product, price, renewal_date, status, est_saving)
runs(id, deal_id, status, created_at)
run_steps(id, run_id, lane, kind, text, created_at)   -- powers the live log
messages(id, run_id, role[buyer|vendor_sim|judge], round, text)
receipts(id, run_id, claim, source_url, screenshot_url, verified bool)
Enable RLS so users see only their own rows.
(supabase/schema.sql in this repo already defines these; use it.)

SCREENS (only these)
1. Landing: one-line pitch "For small teams that auto-renew software they never
   review: forward a renewal, and two agents rehearse the negotiation with
   receipts." Big "Try a sample renewal" button + sign in.
2. New deal: paste an email OR choose one of 3 seeded samples (project management
   tool, domain/hosting, cloud storage; realistic fake emails for vendors with
   public pricing). Sample works WITHOUT sign-up.
3. Live run: streaming step log, then a two-sided rehearsal view (buyer vs vendor
   sim, each claim linking to its receipt), then final email + verification badge +
   est. saving. Buttons: Copy, "Approve" (approval only; do NOT send real email).
   Include "You be the vendor": a text box where the user types a vendor
   objection and the buyer agent replies with evidence.
4. Deals dashboard: list with status and total estimated savings.
5. Pricing: a non-functional "Pro: coming soon" button. No Stripe.

NON-NEGOTIABLES
- Rate limit per user/IP and cap spend per run. Friendly error states everywhere.
- Add /api/health that checks the database and one model call.
- A run must continue server-side if the browser closes; the page only watches
  progress (Supabase realtime or short polling). Never hold one request open for a
  whole run.
- Clean, minimal UI; mobile-friendly; judges will open it on phones.
- Label the vendor rep "Simulated rehearsal partner, not a prediction."

WORKING STYLE
Small steps. After each, tell me exactly how to test it. Do not add features I did
not ask for. Ask me only for things you truly cannot do (API keys, dashboards).
