import { NextResponse } from "next/server";

/**
 * API Route for KittyNotary contract interactions.
 *
 * Supports two modes:
 * 1. Local mode (no API_URL): Spawns Python helper directly (for local dev)
 * 2. External mode (API_URL set): Proxies to external API server (for Vercel)
 */

const EXTERNAL_API_URL = process.env.API_URL;

// --- External API mode (Vercel) ---
async function proxyToExternal(body: unknown): Promise<NextResponse> {
  if (!EXTERNAL_API_URL) {
    return NextResponse.json(
      { error: "API_URL not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${EXTERNAL_API_URL}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[api/rpc] external API error:", err);
    return NextResponse.json(
      { error: "Failed to connect to API server" },
      { status: 502 }
    );
  }
}

// --- Local mode (spawn Python helper) ---
// Only used when API_URL is not set (local development)

const ALLOWED_ACTIONS = new Set(["read", "build", "views"]);

const READ_METHODS = new Set([
  "get_count",
  "get_record",
  "get_record_by_id",
  "get_records_by_requester",
]);

const BUILD_METHODS = new Set(["notarize"]);

const MAX_ARGS = 4;
const MAX_ARG_STRING = 2048;
const MAX_VIEWS_PER_BATCH = 12;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const CACHE_TTL_MS = 3_000;
const responseCache = new Map<string, { at: number; body: unknown }>();

function getCached(key: string): unknown | undefined {
  const hit = responseCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.body;
  responseCache.delete(key);
  return undefined;
}

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 60;
const rateHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (rateHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_REQUESTS) {
    rateHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateHits.set(ip, recent);
  if (rateHits.size > 5_000) rateHits.clear();
  return false;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}

function sanitizeError(message: string): string {
  return message
    .replace(/(?:[A-Za-z]:)?[\\/][\w\-. ]+\.(?:py|js|ts|mjs|json)/g, "[path]")
    .slice(0, 300);
}

interface RpcBody {
  action?: unknown;
  method?: unknown;
  args?: unknown;
  from?: unknown;
  views?: unknown;
}

function validateArgs(args: unknown): string | null {
  if (!Array.isArray(args) || args.length > MAX_ARGS) {
    return `args must be an array of at most ${MAX_ARGS} items`;
  }
  for (const arg of args as unknown[]) {
    const type = typeof arg;
    if (arg !== null && type !== "string" && type !== "number" && type !== "boolean") {
      return "args may only contain strings, numbers, booleans or null";
    }
    if (typeof arg === "string" && arg.length > MAX_ARG_STRING) {
      return `string arguments are limited to ${MAX_ARG_STRING} characters`;
    }
    if (typeof arg === "number" && !Number.isSafeInteger(arg)) {
      return "numbers must be safe integers";
    }
  }
  return null;
}

function parseHelperOutput(
  stdout: string
): { ok: true; body: unknown } | { ok: false; error: string; status: number } {
  const lines = stdout.trim().split("\n");
  const last = lines[lines.length - 1];
  let parsed: { result?: unknown; error?: string };
  try {
    parsed = JSON.parse(last);
  } catch {
    console.error("[api/rpc] unparseable helper output:", last?.slice(0, 500));
    return { ok: false, error: "helper returned invalid output", status: 502 };
  }
  if (parsed.error) {
    return { ok: false, error: sanitizeError(parsed.error), status: 502 };
  }
  return { ok: true, body: parsed };
}

let helperChain: Promise<unknown> = Promise.resolve();
function enqueueHelper<T>(fn: () => Promise<T>): Promise<T> {
  const run = helperChain.then(fn, fn);
  helperChain = run.catch(() => undefined);
  return run;
}

async function spawnHelper(cmdArgs: string[]): Promise<string> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const path = await import("node:path");
  const execFileAsync = promisify(execFile);

  const ROOT = path.resolve(process.cwd(), "server");
  const HELPER = path.join(ROOT, "server", "deploy", "api_helper.py");
  const pythonBin = process.env.PYTHON_BIN || "python";

  return enqueueHelper(async () => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { stdout } = await execFileAsync(pythonBin, cmdArgs, {
          cwd: ROOT,
          timeout: 180_000,
          maxBuffer: 4 * 1024 * 1024,
          windowsHide: true,
          env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
        });
        return stdout;
      } catch (err) {
        console.error(`[api/rpc] helper failed (attempt ${attempt}):`, err);
        if (attempt === 2) throw new Error("upstream helper failed");
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    throw new Error("unreachable");
  });
}

export async function POST(request: Request) {
  if (isRateLimited(clientIp(request))) {
    return NextResponse.json(
      { error: "Too many requests; slow down a little" },
      { status: 429 }
    );
  }

  let body: RpcBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  // --- External API mode ---
  if (EXTERNAL_API_URL) {
    return proxyToExternal(body);
  }

  // --- Local mode (Python helper) ---
  const { action, method, args, from } = body;

  if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: `action must be one of ${[...ALLOWED_ACTIONS].join("|")}` },
      { status: 400 }
    );
  }

  if (action === "views") {
    const views = body.views;
    if (!Array.isArray(views) || views.length === 0 || views.length > MAX_VIEWS_PER_BATCH) {
      return NextResponse.json(
        { error: `views must be an array of 1..${MAX_VIEWS_PER_BATCH} items` },
        { status: 400 }
      );
    }
    for (const item of views) {
      const v = item as { method?: unknown; args?: unknown };
      if (typeof v.method !== "string" || !READ_METHODS.has(v.method)) {
        return NextResponse.json(
          { error: `view method not allowed: ${String(v.method).slice(0, 40)}` },
          { status: 400 }
        );
      }
      const err = validateArgs(v.args ?? []);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    const cacheKey = JSON.stringify({ a: "views", v: views });
    const hit = getCached(cacheKey);
    if (hit !== undefined) {
      return NextResponse.json(hit as Record<string, unknown>);
    }

    try {
  const ROOT = (await import("node:path")).resolve(process.cwd(), "server");
      const HELPER = (await import("node:path")).join(ROOT, "server", "deploy", "api_helper.py");
      const stdout = await spawnHelper([HELPER, "views", "", JSON.stringify(views)]);
      const parsed = parseHelperOutput(stdout);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: parsed.status });
      }
      responseCache.set(cacheKey, { at: Date.now(), body: parsed.body });
      return NextResponse.json(parsed.body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "upstream helper failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (typeof method !== "string") {
    return NextResponse.json({ error: "method must be a string" }, { status: 400 });
  }

  if (action === "read" && !READ_METHODS.has(method)) {
    return NextResponse.json({ error: `method not allowed: ${method}` }, { status: 400 });
  }
  if (action === "build" && !BUILD_METHODS.has(method)) {
    return NextResponse.json({ error: `method not allowed: ${method}` }, { status: 400 });
  }

  const argsErr = validateArgs(args ?? []);
  if (argsErr) {
    return NextResponse.json({ error: argsErr }, { status: 400 });
  }

      const ROOT = (await import("node:path")).resolve(process.cwd(), "server");
  const HELPER = (await import("node:path")).join(ROOT, "server", "deploy", "api_helper.py");
  const cmdArgs = [
    HELPER,
    action,
    method,
    JSON.stringify((Array.isArray(args) ? args : []) as Array<string | number | boolean | null>),
  ];

  if (action === "build") {
    if (typeof from !== "string" || !ADDRESS_RE.test(from)) {
      return NextResponse.json(
        { error: "build requires a valid `from` address (0x + 40 hex chars)" },
        { status: 400 }
      );
    }
    cmdArgs.push(from);
  }

  const cacheable = action === "read" && method !== "get_record_by_id";
  const cacheKey = JSON.stringify(cmdArgs.slice(1));
  if (cacheable) {
    const hit = getCached(cacheKey);
    if (hit !== undefined) {
      return NextResponse.json(hit as Record<string, unknown>);
    }
  }

  try {
    const stdout = await spawnHelper(cmdArgs);
    const parsed = parseHelperOutput(stdout);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    if (cacheable) {
      responseCache.set(cacheKey, { at: Date.now(), body: parsed.body });
      if (responseCache.size > 500) responseCache.clear();
    }
    return NextResponse.json(parsed.body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "upstream helper failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
