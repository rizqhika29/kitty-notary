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