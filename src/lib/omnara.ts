// Server only. Thin REST wrapper around Omnara Cloud. Docs: https://docs.omnara.com/api/overview
import { INSTRUCTION } from "./agent/instruction";

const API = "https://app.omnara.com/api/v1";
const org = () => process.env.OMNARA_ORG_ID!;
const proj = () => process.env.OMNARA_PROJECT_ID!;

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.OMNARA_API_KEY;
  if (!key) throw new Error("OMNARA_API_KEY is not set");
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(API + path, {
        method,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (r.status === 429 || r.status >= 500) {
        lastErr = new Error(`Omnara ${r.status}`);
        await new Promise((res) => setTimeout(res, 800 * (attempt + 1) ** 2));
        continue;
      }
      const text = await r.text();
      if (!r.ok) throw new Error(`Omnara ${method} ${path} failed: ${r.status} ${text.slice(0, 300)}`);
      return (text ? JSON.parse(text) : {}) as T;
    } catch (e) {
      lastErr = e;
      if (e instanceof Error && e.message.startsWith("Omnara ") && !e.message.includes("failed:")) continue;
      if (e instanceof Error && e.message.includes("failed:")) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Omnara request failed");
}

const base = () => `/orgs/${org()}/projects/${proj()}`;

type Secret = { id: string; name: string };
let secretIds: Record<string, string> | null = null;

// Keys the agent needs inside its sandbox. Stored once as project secrets; values never come back from the API.
async function ensureSecrets(): Promise<Record<string, string>> {
  if (secretIds) return secretIds;
  const wanted: Record<string, { name: string; value: string }> = {
    CONTEXT_DEV_API_KEY: { name: "rn-context-dev-key", value: process.env.CONTEXT_DEV_API_KEY ?? "" },
    SUPABASE_URL: { name: "rn-supabase-url", value: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "" },
    SUPABASE_SERVICE_KEY: { name: "rn-supabase-service-key", value: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "" },
  };
  const list = await call<{ data: { secret?: Secret; id?: string; name?: string }[] }>("GET", `${base()}/secrets`);
  const existing = new Map(list.data.map((s) => [s.secret?.name ?? s.name, s.secret?.id ?? s.id]));
  const out: Record<string, string> = {};
  for (const [env, w] of Object.entries(wanted)) {
    let id = existing.get(w.name);
    if (!id) {
      if (!w.value) throw new Error(`${env} is not configured`);
      const created = await call<{ id: string }>("POST", `/orgs/${org()}/secrets`, {
        owner: { kind: "project", project_id: proj() },
        name: w.name,
        material: { kind: "generic", value: w.value },
      });
      id = created.id;
    }
    out[env] = id!;
  }
  secretIds = out;
  return out;
}

let configId: string | null = null;

// Same source returns the same immutable config, so this is cheap after the first call.
async function ensureConfig(): Promise<string> {
  if (configId) return configId;
  const s = await ensureSecrets();
  const source = `version: v1
instruction: |
${INSTRUCTION.split("\n").map((l) => "  " + l).join("\n")}
model:
  provider_config: omnara-openrouter
  name: ${process.env.OMNARA_MODEL ?? "anthropic/claude-sonnet-5.5"}
tools:
  run_command: {}
machine_sources:
  - machine_pool_name: default-pool
    cwd: /workspace
    secret_env_overlay:
      CONTEXT_DEV_API_KEY: ${s.CONTEXT_DEV_API_KEY}
      SUPABASE_URL: ${s.SUPABASE_URL}
      SUPABASE_SERVICE_KEY: ${s.SUPABASE_SERVICE_KEY}
`;
  const cfg = await call<{ id: string }>("POST", `${base()}/agent-configs`, { source, source_format: "yaml" });
  configId = cfg.id;
  return cfg.id;
}

export async function launchAgent(name: string, message: string): Promise<string> {
  const config = await ensureConfig();
  const res = await call<{ agent: { id: string } }>("POST", `${base()}/agents`, { config, name, message });
  return res.agent.id;
}

export async function sendInput(agentId: string, text: string): Promise<void> {
  await call("POST", `${base()}/agents/${agentId}/inputs`, { content_blocks: [{ type: "text", text }] });
}

export async function cancelAgent(agentId: string): Promise<void> {
  await call("POST", `${base()}/agents/${agentId}/cancel`, {});
}

export async function omnaraReachable(): Promise<boolean> {
  await call("GET", `/orgs/${org()}/projects`);
  return true;
}
