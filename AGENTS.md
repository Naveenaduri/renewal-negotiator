Read SPEC.md before doing anything. Work in small steps, tell me how to test each, add no features not in the spec, never invent prices, keep keys server-side.

## Context.dev (web research and receipts)
- Env var: `CONTEXT_DEV_API_KEY` (server-side only, in `.env.local`; never import the wrapper from client code).
- All calls go through `src/lib/contextdev.ts` (`scrapePage`, `searchWeb`), built on the `context.dev` npm SDK, which retries 408/429/5xx and honors Retry-After.
- Endpoints used: `POST /web/scrape` (markdown + screenshot, 1 credit) https://docs.context.dev/api-reference/web-scraping/scrape ; `POST /web/search` (1 credit per 10 results) https://docs.context.dev/api-reference/web-scraping/search . `POST /web/answers` (10-100 credits) is not wired yet: https://docs.context.dev/api-reference/web-extraction/answers
- Receipts: scrape with `maxAgeMs: 0` so every price claim is a fresh fetch.
- Screenshots come back as a `data:image/png;base64,...` string, not a URL. Store them in Supabase Storage and save that URL in `receipts.screenshot_url`.
- Tests must mock `src/lib/contextdev.ts`; real calls cost credits.
- Troubleshooting: https://docs.context.dev/optimization/troubleshooting

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Context.dev (research, scrape, screenshots)

Every price claim needs a receipt: `{claim, source_url, screenshot_url, fetched_at}`. **Never invent a price.**

- **Secret:** `CONTEXT_DEV_API_KEY`. Set it in `.env.local` for dev (gitignored) and in Vercel project env vars. It is server-only: never hardcode it, never use a `NEXT_PUBLIC_` prefix. Rotate keys at https://www.context.dev/dashboard/api-keys. Optional: `CONTEXT_DEV_MAX_CONCURRENCY` (default 2, the Free plan's concurrent-request limit).
- **One wrapper:** `src/lib/context-dev.ts` is the only module that imports the `context.dev` SDK (npm `context.dev` v3.x). It is marked `import "server-only"`. Add new endpoints there and don't call the API from anywhere else.
  - Exports: `answer()` (Answers), `searchWeb()` (Search), `capturePageEvidence()` (Scrape with screenshot + highlights), `ContextDevError` (status, errorCode, requestId, retryable).
- **Receipt check:** `src/lib/price-match.ts` → `priceAppearsIn(price, passages)`. A price counts as verified only if its number appears in passages from the fetched page.
- **Retries:** the SDK handles them (`maxRetries: 2`). It retries 408/409/429/5xx with bounded backoff and honors `Retry-After`. It never retries 400/401/402/403/422. Answers uses `maxRetries: 1`. Keep the client timeout longer than `timeoutOpts.milliseconds` (the wrapper adds 15s headroom).
- **Freshness:** Scrape caches for 3 days by default. The wrapper sends `maxAgeMs` explicitly: 24h by default, or `0` to force a fresh capture.
- **Screenshots:** use Scrape `formats.screenshot`. It returns a base64 `data:image/...` URL and has no hosted URL. Do NOT use the SDK's legacy `client.web.screenshot()` (GET /web/screenshot).
- **Supabase receipts:** `receipts.screenshot_url` (supabase/schema.sql) expects a URL. Upload the image to Supabase Storage and store that URL. Never put base64 in Postgres or in an API response, because Vercel limits responses to 4.5 MB.
- **Scrape outputs:** a 200 response can still contain failed outputs, so check `output.success` before reading `data`.
- **Tests:** `npm test` (vitest). Mock `@/lib/context-dev` with `vi.mock`. Tests never hit the live API, because every call costs credits.
- **Troubleshooting:** log `request_id` (the wrapper does this on every call). For failures or empty results, see https://docs.context.dev/optimization/troubleshooting. If a Context.dev response is wrong or differs from the docs, report it once with `POST https://api.context.dev/v1/feedback` (0 credits), include the `request_id`, and never include secrets.

| Endpoint | Wrapper fn | Use | Cost | Docs |
| - | - | - | - | - |
| `POST /web/answers` (`fast`) | `answer()` | Find vendor plans and 2-3 alternatives, with a cited `source_url` per price | 10 credits (ultra: 100) | https://docs.context.dev/api-reference/web-extraction/answers |
| `POST /web/search` | `searchWeb()` | Find a pricing page when no source was cited | 1 credit / 10 results | https://docs.context.dev/api-reference/web-scraping/search |
| `POST /web/scrape` (`screenshot` + `highlights`) | `capturePageEvidence()` | The receipt: screenshot plus passages that prove the price | 1 credit, +1 with highlights | https://docs.context.dev/api-reference/web-scraping/scrape |

Other docs: SDK https://docs.context.dev/sdks/typescript · credits https://docs.context.dev/account/credits · timeouts https://docs.context.dev/optimization/timeouts · caching https://docs.context.dev/scrape/freshness-and-caching.

## Omnara (agents), notes from the docs

Docs: https://docs.omnara.com (LLM index: https://docs.omnara.com/llms.txt). API base: `https://api.omnara.com/v1/orgs/{orgID}/projects/{projectID}`, with `Authorization: Bearer <API key>`. TypeScript SDK: `@omnara/sdk`.

- **Launch:** `POST .../agent-configs` with YAML (`instruction`, `model`, `tools`, `event_webhook`), then `POST .../agents {config, name, message}` with an `Idempotency-Key` header. Omnara Cloud ships with model provider `omnara-openrouter`. Our agents need no machine (no `machine_sources`).
- **Our tools are `type: custom`.** Omnara holds each call durably, our server executes it, then posts `POST .../agents/{id}/tool-calls/{tcl}/result {outcome, content_blocks}`. The first result wins; a duplicate gets `409`, which makes retries safe.
- **Events reach the app by webhook, not SSE.** `event_webhook` POSTs `model_output`, `tool_result` and `tool_call_update` to a Vercel route, signed with Standard Webhooks (`standardwebhooks`). Omnara waits only **5 seconds** for a response, and deliveries can arrive duplicated or out of order (dedupe by `Webhook-Id` / tool-call ID). So the route verifies the signature, returns 2xx immediately, and runs the tool in `after()` (from `next/server`, which runs within the route's `maxDuration`). The webhook writes `run_steps`, and the page watches Supabase realtime. Never hold a request open for a whole run.
- **Approval gate:** `permission: {mode: always_ask}` on a tool pauses the call in `awaiting_permission` and opens an interaction. Resolve it with `POST .../agents/{id}/interactions/{int}/resolve {answers:[{option_indices:[0]}]}` (0 = Allow, 1 = Deny).
- **Fallback (per SPEC):** if an Omnara run is not streaming events into the app within 60 minutes of starting the integration, switch to calling the Anthropic API directly from a server route, and tell the user.
## Agent pipeline (end to end)
- `POST /api/runs` (needs `Authorization: Bearer <supabase jwt>`, anonymous sessions work) creates deal + run, launches ONE Omnara agent (Claude Sonnet 5.5 via Omnara's provider, no Anthropic key) and returns `runId`. `after()` runs `watchRun`, which finalizes when the agent sets `runs.status = agent_done`.
- The agent runs in Omnara's sandbox with secrets injected as env (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `CONTEXT_DEV_API_KEY`, project secrets `rn-*`). Its only interface is the `rn.py` helper (source in `src/lib/agent/instruction.ts`), which writes `run_steps`, `messages`, `receipts`, `deals`, `runs` and caps context.dev at 8 calls per run.
- Run statuses: queued, running, agent_done, verifying, complete, failed. Runs over 12 minutes are cancelled (`reapIfStale`).
- Verifier (`src/lib/verify.ts`) is code, not a model: re-scrapes each receipt URL and checks every `$` amount in the claim appears on the page; stores screenshots in the public `receipts` storage bucket.
- `POST /api/runs/[id]/finalize` is an idempotent nudge from the page; `POST /api/runs/[id]/objection` forwards "You be the vendor" input to the same agent as `OBJECTION: ...`.
- Limits: 6 runs/hour/user, 12/hour/IP (in memory), 8 concurrent runs. `/api/health` checks DB, Omnara and the research key (`?deep=1` also launches a tiny agent).
- UI: `/run/[id]` watches Supabase realtime plus a 3s poll. `/run/demo` is the scripted replay.
