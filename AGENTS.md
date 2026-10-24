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

## Agent pipeline (end to end)
- `POST /api/runs` (needs `Authorization: Bearer <supabase jwt>`, anonymous sessions work) creates deal + run, launches ONE Omnara agent (Claude Sonnet 5.5 via Omnara's provider, no Anthropic key) and returns `runId`. `after()` runs `watchRun`, which finalizes when the agent sets `runs.status = agent_done`.
- The agent runs in Omnara's sandbox with secrets injected as env (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `CONTEXT_DEV_API_KEY`, project secrets `rn-*`). Its only interface is the `rn.py` helper (source in `src/lib/agent/instruction.ts`), which writes `run_steps`, `messages`, `receipts`, `deals`, `runs` and caps context.dev at 8 calls per run.
- Run statuses: queued, running, agent_done, verifying, complete, failed. Runs over 12 minutes are cancelled (`reapIfStale`).
- Verifier (`src/lib/verify.ts`) is code, not a model: re-scrapes each receipt URL and checks every `$` amount in the claim appears on the page; stores screenshots in the public `receipts` storage bucket.
- `POST /api/runs/[id]/finalize` is an idempotent nudge from the page; `POST /api/runs/[id]/objection` forwards "You be the vendor" input to the same agent as `OBJECTION: ...`.
- Limits: 6 runs/hour/user, 12/hour/IP (in memory), 8 concurrent runs. `/api/health` checks DB, Omnara and the research key (`?deep=1` also launches a tiny agent).
- UI: `/run/[id]` watches Supabase realtime plus a 3s poll. `/run/demo` is the scripted replay.
