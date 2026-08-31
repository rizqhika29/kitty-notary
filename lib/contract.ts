import type { NotarizationRecord } from "@/types";
import { keccak256, stringToHex } from "viem";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x00000000000000000000000000000000000000";

interface RpcResponse {
  result?: unknown;
  error?: string;
}

async function rpc(
  action: "read" | "build",
  method: string,
  args: unknown[] = [],
  from?: string
) {
  const res = await fetch("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, method, args, from }),
  });
  const data = (await res.json()) as RpcResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error || `RPC failed (${res.status})`);
  }
  return data.result;
}

export function getContractAddress() {
  return CONTRACT_ADDRESS;
}

export async function getContractInfo() {
  try {
    const count = await rpc("read", "get_count", []);
    return { address: CONTRACT_ADDRESS, count };
  } catch {
    return null;
  }
}

export interface BuiltTransaction {
  to: string;
  data: string;
  chainId: number;
  value: string;
}

/** Build the unsigned addTransaction payload a wallet should sign+broadcast. */
export async function buildNotarizeTx(
  claim: string,
  sourceUrl: string,
  from: string
): Promise<BuiltTransaction> {
  const result = (await rpc("build", "notarize", [claim, sourceUrl], from)) as
    | BuiltTransaction
    | undefined;
  if (
    !result ||
    typeof result.to !== "string" ||
    typeof result.data !== "string" ||
    !result.data.startsWith("0x")
  ) {
    throw new Error("Failed to build the transaction payload — please retry");
  }
  return result;
}

export async function getRecord(index: number) {
  const result = await rpc("read", "get_record", [index]);
  return result as string;
}

export async function fetchRecord(index: number): Promise<NotarizationRecord | null> {
  const raw = await getRecord(index);
  if (!raw || raw === "{}") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getRecordCount() {
  const result = await rpc("read", "get_count", []);
  return result;
}

export async function getRecordsByRequester(requester: string) {
  const result = await rpc("read", "get_records_by_requester", [requester]);
  return result as string;
}

export async function getRecordById(recordId: string) {
  const result = await rpc("read", "get_record_by_id", [recordId]);
  return result as string;
}

export interface ViewCall {
  method: string;
  args?: unknown[];
}

/** Run several read-only views in ONE server round-trip / helper process.
 *  Failed entries come back as null (aligned with the input order). */
export async function batchViews(calls: ViewCall[]): Promise<unknown[]> {
  const res = await fetch("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "views", views: calls }),
  });
  const data = (await res.json()) as RpcResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error || `RPC failed (${res.status})`);
  }
  return (data.result as unknown[]) ?? [];
}

/** keccak256(claim_utf8 || 0x00 || url_utf8) hex — mirrors ai_notary._make_id
 *  (GenLayer's Keccak256, NOT SHA-256) so a submission can be correlated to
 *  exactly its own record even when other users are transacting concurrently. */
export function computeRecordId(claim: string, sourceUrl: string): string {
  return keccak256(stringToHex(`${claim}\u0000${sourceUrl}`)).slice(2);
}

/** Check if a transaction was reverted on-chain. Returns the receipt or null. */
export async function getTransactionReceipt(
  txHash: string
): Promise<{ status: string; logs?: unknown[] } | null> {
  try {
    const w = (window as unknown as Record<string, unknown>).ethereum as
      | { request: (args: { method: string; params: string[] }) => Promise<unknown> }
      | undefined;
    if (!w) return null;
    const receipt = await w.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });
    return receipt as { status: string; logs?: unknown[] } | null;
  } catch {
    return null;
  }
}

/** Wait for a transaction receipt with retry. Returns receipt or null on timeout. */
export async function waitForReceipt(
  txHash: string,
  maxAttempts = 10,
  intervalMs = 3000
): Promise<{ status: string; logs?: unknown[] } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const receipt = await getTransactionReceipt(txHash);
    if (receipt) return receipt;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}