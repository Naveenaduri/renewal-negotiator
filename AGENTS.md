Read SPEC.md before doing anything. Work in small steps, tell me how to test each, add no features not in the spec, never invent prices, keep keys server-side.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Context.dev (web data: pricing research, screenshots)

Renewal Negotiator uses [Context.dev](https://docs.context.dev) to research vendor pricing. **Every price must come with a source URL and a screenshot.**

### Conventions
- **Secret:** `CONTEXT_DEV_API_KEY`. Set it in `.env.local` for dev (gitignored) and in Vercel with `vercel env add CONTEXT_DEV_API_KEY`. It is server-only: never hardcode it, never use a `NEXT_PUBLIC_` prefix. Rotate keys at https://www.context.dev/dashboard/api-keys. Optional: `CONTEXT_DEV_MAX_CONCURRENCY` (default 2, the Free plan's concurrent-request limit). See `.env.example`.
- **One wrapper:** `src/lib/context-dev.ts` is the only module that imports the `context.dev` SDK (npm `context.dev`, v3.x). It is marked `import "server-only"`. Add new endpoints there. Do not call the SDK or `fetch` api.context.dev from anywhere else.
  - Exports: `answer()` (Answers), `searchWeb()` (Search), `capturePageEvidence()` (Scrape with screenshot + highlights), `ContextDevError` (status, errorCode, requestId, retryable).
- **Built on top:** `src/lib/negotiator.ts` (Answers → Search fallback → Scrape evidence) → `POST /api/research`. A single-URL capture/re-capture goes through `POST /api/evidence`. Client-safe types live in `src/lib/report-types.ts`. Client components must import only those types.
- **Retries:** handled by the SDK (`maxRetries: 2`). It retries 408/409/429/5xx with bounded exponential backoff and honors `Retry-After`. It never retries 400/401/402/403/422. Answers uses `maxRetries: 1`. Keep the client timeout longer than `timeoutOpts.milliseconds` (the wrapper adds 15s headroom).
- **Freshness:** Scrape caches for 3 days by default. The wrapper sends `maxAgeMs` explicitly: 24h by default, and `0` when the caller passes `fresh: true`. Answers can reuse page reads up to 30 days old in fast mode.
- **Screenshots:** use Scrape `formats.screenshot`. It returns a `data:image/...;base64` URL and has no hosted URL. Do NOT use the SDK's legacy `client.web.screenshot()` (GET /web/screenshot). Default is a JPEG of the viewport, because Vercel limits function responses to 4.5 MB. `/api/research` drops the largest screenshots if the payload goes over 4 MB.
- **Supabase receipts:** `receipts.screenshot_url` (supabase/schema.sql) expects a URL, but Scrape returns base64 data URLs. Upload them to Supabase Storage before inserting a receipt (not implemented yet).
- **Scrape outputs:** a 200 response can still contain failed outputs, so check `output.success` before reading `data`.
- **Next 16 + Cache Components:** don't export `runtime` from route files. `maxDuration` is fine (research = 120s).
- **Tests:** `npm test` (vitest) mocks `@/lib/context-dev` with `vi.mock`. Automated tests must never hit the live API, because every call costs credits. Manual smoke test (about 2 credits): run `npm run dev`, then `curl -X POST localhost:3000/api/evidence -H 'content-type: application/json' -d '{"url":"https://linear.app/pricing","query":"plan prices?"}'`.
- **Troubleshooting:** log `request_id` (the wrapper does this on every call). For failures or empty results, see https://docs.context.dev/optimization/troubleshooting. If a Context.dev response is wrong or differs from the docs, report it once with `POST https://api.context.dev/v1/feedback` (0 credits), include the affected `request_id`, and never include secrets.

### Endpoints in use (read the docs before changing a call; append `.md` for markdown)
| Endpoint | Wrapper fn | Why | Cost | Docs |
| - | - | - | - | - |
| `POST /web/answers` (mode `fast`) | `answer()` | Structured plans and alternatives, with a cited `source_url` per price | 10 credits (ultra: 100) | https://docs.context.dev/api-reference/web-extraction/answers |
| `POST /web/search` | `searchWeb()` | Finds a pricing page when Answers cites no source | 1 credit / 10 results | https://docs.context.dev/api-reference/web-scraping/search |
| `POST /web/scrape` (`screenshot` + `highlights`) | `capturePageEvidence()` | A screenshot of each source URL, plus passages used to verify the price text | 1 credit, +1 with highlights | https://docs.context.dev/api-reference/web-scraping/scrape, https://docs.context.dev/scrape/screenshot |

Other relevant docs: SDK https://docs.context.dev/sdks/typescript · credits https://docs.context.dev/account/credits · timeouts https://docs.context.dev/optimization/timeouts · caching https://docs.context.dev/scrape/freshness-and-caching. For watching price changes, use Monitors (`POST /monitors`, https://docs.context.dev/monitors/overview) rather than a polling loop. For more than a few hundred URLs, use Batches (https://docs.context.dev/batches/overview).
