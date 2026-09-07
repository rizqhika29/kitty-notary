import { NextResponse } from "next/server";
import { genCall, buildTransaction } from "@/lib/genlayer/rpc";
import { STUDIONET } from "@/lib/genlayer/chain";

const RPC_URL = process.env.GENLAYER_RPC_URL || STUDIONET.rpcUrl;
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const SENDER = process.env.NEXT_PUBLIC_SENDER_ADDRESS || "";

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

function setCached(key: string, body: unknown) {
  responseCache.set(key, { at: Date.now(), body });
  if (responseCache.size > 500) responseCache.clear();
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

function validateArgs(args: unknown): string | null {
  if (!Array.isArray(args) || args.length > MAX_ARGS) {
    return `args must be an array of at most ${MAX_ARGS} items`;
  }
  for (const arg of args) {
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

  const { action, method, args } = body;

  if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: `action must be one of ${[...ALLOWED_ACTIONS].join("|")}` },
      { status: 400 }
    );
  }

  // --- views (batch read) ---
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

    const ck = JSON.stringify({ a: "views", v: views });
    const hit = getCached(ck);
    if (hit !== undefined) return NextResponse.json(hit as Record<string, unknown>);

    try {
      const results = await Promise.all(
        views.map(async (item: { method: string; args?: (string | number | boolean | null)[] }) => {
          try {
            return await genCall(RPC_URL, CONTRACT, SENDER, item.method, item.args ?? []);
          } catch {
            return null;
          }
        })
      );
      const result = { result: results };
      setCached(ck, result);
      return NextResponse.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "views failed";
      return NextResponse.json({ error: sanitizeError(message) }, { status: 502 });
    }
  }

  // --- read / build ---
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

  if (action === "build") {
    const from = body.from;
    if (typeof from !== "string" || !ADDRESS_RE.test(from)) {
      return NextResponse.json(
        { error: "build requires a valid `from` address (0x + 40 hex chars)" },
        { status: 400 }
      );
    }
  }

  const cacheable = action === "read" && method !== "get_record_by_id";
  const ck = JSON.stringify({ a: action, m: method, args });
  if (cacheable) {
    const hit = getCached(ck);
    if (hit !== undefined) return NextResponse.json(hit as Record<string, unknown>);
  }

  try {
    let result: unknown;
    const safeArgs = Array.isArray(args) ? args : [];

    if (action === "read") {
      result = await genCall(RPC_URL, CONTRACT, SENDER, method, safeArgs);
    } else {
      const from = body.from as string;
      result = buildTransaction(CONTRACT, from, method, safeArgs);
    }

    const response = { result };
    if (cacheable) setCached(ck, response);
    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: sanitizeError(message) }, { status: 502 });
  }
}
