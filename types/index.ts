export interface NotarizationRecord {
  record_id?: string;
  claim: string;
  source_url: string;
  verdict: "VERIFIED" | "NOT_VERIFIED" | "UNCERTAIN";
  reason: string;
  /** Integer basis points 0..10000 as stored on-chain (9500 = 0.95). */
  confidence: number;
  requester: string;
  timestamp?: number | string;
  __index?: number;
  /** Keccak-256 hex digest of the exact fetched source content. */
  content_digest?: string;
  /** First ~500 chars of the fetched source content for audit display. */
  content_excerpt?: string;
  /** Unix timestamp when the source was fetched. */
  fetched_at?: number;
  /** Unix timestamp when this record becomes stale (fetched_at + TTL). */
  expires_at?: number;
  /** Record ID of the previous version (set on re-notarization). */
  parent_record_id?: string;
  /** Content digest of the previous version (set on re-notarization). */
  parent_digest?: string;
}

export interface ContractState {
  address: string;
  count: number;
}

export interface ClaimSubmission {
  claim: string;
  sourceUrl: string;
  txHash?: string;
  status: "idle" | "submitting" | "success" | "error";
  error?: string;
}