import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export function getVerdictColor(verdict: string): string {
  switch (verdict?.toUpperCase()) {
    case "VERIFIED":
      return "text-green-600 bg-green-50 border-green-200";
    case "NOT_VERIFIED":
      return "text-red-600 bg-red-50 border-red-200";
    case "UNCERTAIN":
      return "text-yellow-600 bg-yellow-50 border-yellow-200";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-green-600";
  if (confidence >= 0.5) return "text-yellow-600";
  return "text-red-600";
}

/** Coerce on-chain confidence to a finite ratio in [0, 1].
 *  The contract stores integer basis points (0..10000); legacy values in
 *  the 0..1 range are passed through unchanged. */
export function safeConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  const ratio = Math.abs(n) > 1 ? n / 10000 : n;
  return Math.min(1, Math.max(0, ratio));
}

/** Only allow http(s) URLs from the chain into href attributes. */
export function safeSourceHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}