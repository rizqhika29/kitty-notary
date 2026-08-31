"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { useToast } from "@/components/ui/Toast";
import {
  batchViews,
  buildNotarizeTx,
  computeRecordId,
  getRecordById,
  waitForReceipt,
} from "@/lib/contract";
import { safeConfidence, safeSourceHref } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { KittyCartoon, PawPrint } from "@/components/cat";
import type { NotarizationRecord } from "@/types";

const MAX_CLAIM = 500; // keep in sync with contracts/ai_notary.py
const MAX_SOURCE_URL = 2048;
const POLL_INTERVAL_MS = 10_000;
const POLL_MAX_ATTEMPTS = 60; // ~10 minutes of active waiting

type Phase = "idle" | "signing" | "pending" | "confirmed" | "deferred";

interface Submitted {
  recordId: string;
  claim: string;
  url: string;
  txHash: string;
}

export default function ClaimForm() {
  const { toast } = useToast();
  const { address, connect, sendTransaction } = useWallet();
  const [claim, setClaim] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [confirmed, setConfirmed] = useState<NotarizationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentRecords, setRecentRecords] = useState<NotarizationRecord[]>([]);

  const claimValid = claim.trim().length > 0 && claim.trim().length <= MAX_CLAIM;
  let urlValid = false;
  try {
    const parsed = new URL(sourceUrl.trim());
    urlValid =
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      sourceUrl.trim().length <= MAX_SOURCE_URL;
  } catch {
    urlValid = false;
  }
  const busy = phase === "signing" || phase === "pending";
  const formValid = claimValid && urlValid && !busy;

  /** Refresh the recent list strictly from the connected wallet's own records,
   *  so concurrent submissions by other users can never leak into it. */
  const loadMyRecent = useCallback(async () => {
    if (!address) return;
    try {
      const head = await batchViews([
        { method: "get_records_by_requester", args: [address.toLowerCase()] },
      ]);
      let indices: number[] = [];
      try {
        const parsed = JSON.parse(String(head[0]));
        indices = Array.isArray(parsed) ? parsed.map(Number) : [];
      } catch {
        indices = [];
      }
      const latest = indices.slice(-5).reverse();
      if (!latest.length) {
        setRecentRecords([]);
        return;
      }
      const results = await batchViews(
        latest.map((i) => ({ method: "get_record", args: [i] }))
      );
      type WithIndex = NotarizationRecord & { __index: number };
      const records = results
        .map((raw, j): WithIndex | null => {
          if (!raw || raw === "{}") return null;
          try {
            return { ...(JSON.parse(String(raw)) as NotarizationRecord), __index: latest[j] };
          } catch {
            return null;
          }
        })
        .filter((r): r is WithIndex => r !== null);
      setRecentRecords(records);
    } catch {
      // non-fatal
    }
  }, [address]);

  useEffect(() => {
    loadMyRecent();
  }, [loadMyRecent]);

  /** Poll for this exact submission via its deterministic record_id instead
   *  of scanning the global list; only a landed record counts as success. */
  const waitForRecord = useCallback(
    async (recordId: string): Promise<NotarizationRecord | null> => {
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        try {
          const raw = await getRecordById(recordId);
          if (raw && raw !== "{}") {
            return JSON.parse(raw) as NotarizationRecord;
          }
        } catch {
          // transient RPC hiccup: keep polling
        }
      }
      return null;
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) return;

    const trimmedClaim = claim.trim();
    const trimmedUrl = sourceUrl.trim();

    setPhase("signing");
    setSubmitted(null);
    setConfirmed(null);
    setError(null);

    try {
      const from = address ?? (await connect());
      if (!from) throw new Error("Connect your wallet to submit a claim");

      const tx = await buildNotarizeTx(trimmedClaim, trimmedUrl, from);
      const hash = await sendTransaction(tx);

      // deterministic keccak-256 id — same formula as the contract
      const recordId = computeRecordId(trimmedClaim, trimmedUrl);

      setSubmitted({ recordId, claim: trimmedClaim, url: trimmedUrl, txHash: hash });
      toast({ title: "Signed & broadcast! 🐾", description: `Tx: ${hash}` });
      setClaim("");
      setSourceUrl("");

      setPhase("pending");

      // Check if transaction was reverted on-chain before polling for record
      const receipt = await waitForReceipt(hash, 10, 3000);
      if (receipt && receipt.status === "0x0") {
        // Transaction reverted — show error immediately
        setPhase("idle");
        setError(
          "Transaction reverted on-chain. The claim may have been rejected by the smart contract (e.g. domain not allowed, invalid input). Check the transaction on Explorer for details."
        );
        toast({
          title: "Transaction Reverted",
          description: "Tx was rejected on-chain",
          variant: "destructive",
        });
        loadMyRecent();
        return;
      }

      // Receipt shows success or not yet available — poll for record
      const record = await waitForRecord(recordId);
      if (record) {
        setConfirmed(record);
        setPhase("confirmed");
        toast({ title: "Consensus reached 🎉", description: record.verdict });
      } else {
        setPhase("deferred");
      }
      loadMyRecent();
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Submission failed");
      toast({
        title: "Error",
        description: "Failed to submit claim",
        variant: "destructive",
      });
    }
  };

  const verdictStyles: Record<string, string> = {
    VERIFIED: "bg-emerald-100 text-emerald-700 border-emerald-300",
    NOT_VERIFIED: "bg-rose-100 text-rose-700 border-rose-300",
    UNCERTAIN: "bg-amber-100 text-amber-700 border-amber-300",
  };

  return (
    <section className="relative mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-10 -right-20 h-72 w-72 rounded-full bg-blob-lilac animate-float-slower" />
      <div className="relative text-center">
        <div className="mx-auto flex h-20 w-20 animate-bob items-center justify-center rounded-3xl bg-white/80 shadow-glow-pink backdrop-blur">
          <KittyCartoon className="h-16 w-16" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          Submit a <span className="text-gradient-pink">Claim</span>
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
          Submit an online event claim with a source URL for on-chain
          verification. Purr-fectly simple.
        </p>
      </div>

      <div className="relative mt-10 rounded-[1.75rem] border border-candy-200 bg-card p-6 shadow-sm sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="claim" className="block text-sm font-bold text-candy-900">
                Your Claim
              </label>
              <span
                className={`text-xs font-semibold ${
                  claim.length > MAX_CLAIM ? "text-rose-600" : "text-muted-foreground"
                }`}
              >
                {claim.length}/{MAX_CLAIM}
              </span>
            </div>
            <textarea
              id="claim"
              rows={3}
              maxLength={MAX_CLAIM}
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="e.g., A magnitude 5.0 earthquake struck Tokyo on July 30"
              className="w-full rounded-2xl border-2 border-candy-200 bg-background px-4 py-3 text-sm transition-colors placeholder:text-muted-foreground focus:border-candy-400 focus:outline-none focus:ring-2 focus:ring-candy-200"
              required
            />
          </div>

          <div>
            <label
              htmlFor="sourceUrl"
              className="mb-2 block text-sm font-bold text-candy-900"
            >
              Source URL
            </label>
            <input
              id="sourceUrl"
              type="url"
              maxLength={MAX_SOURCE_URL}
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://en.wikipedia.org/wiki/..."
              className="w-full rounded-2xl border-2 border-candy-200 bg-background px-4 py-3 text-sm transition-colors placeholder:text-muted-foreground focus:border-candy-400 focus:outline-none focus:ring-2 focus:ring-candy-200"
              required
            />
            {sourceUrl.trim() && !urlValid && (
              <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                Must be a valid http(s) URL of at most {MAX_SOURCE_URL} characters.
                Allowed sources: Wikipedia, Britannica, Reuters, AP News, BBC, The
                Guardian, NYT, Washington Post, Nature, Science, and .gov domains.
              </p>
            )}
            {!address && sourceUrl && urlValid && (
              <p className="mt-2 rounded-xl bg-candy-100 px-3 py-2 text-xs text-candy-700">
                Connect a wallet to enable on-chain submission.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {submitted && (
            <div
              className={`rounded-2xl border-2 px-4 py-4 text-sm ${
                phase === "confirmed"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {phase === "confirmed" && confirmed ? (
                <div className="text-emerald-900">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">Consensus reached 🎉</p>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border-2 px-3 py-0.5 text-xs font-bold ${
                        verdictStyles[confirmed.verdict] ??
                        "bg-gray-100 text-gray-600 border-gray-300"
                      }`}
                    >
                      {confirmed.verdict}
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-emerald-700">
                    AI consensus reasoning
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{confirmed.reason}</p>

                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="font-bold">Confidence:</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-emerald-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-candy-400 to-lilac-400"
                        style={{ width: `${Math.round(safeConfidence(confirmed.confidence) * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-bold">
                      {Math.round(safeConfidence(confirmed.confidence) * 100)}%
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-bold">Claim:</p>
                  <p className="text-xs leading-relaxed">{submitted.claim}</p>

                  <p className="mt-2 text-xs font-bold">Source checked:</p>
                  {safeSourceHref(submitted.url) ? (
                    <a
                      href={submitted.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="block truncate text-xs font-medium underline"
                    >
                      {submitted.url}
                    </a>
                  ) : (
                    <p className="truncate text-xs">{submitted.url}</p>
                  )}

                  <p className="mt-3 break-all font-mono text-[10px] opacity-70">
                    record_id: {confirmed.record_id ?? submitted.recordId}
                  </p>
                </div>
              ) : (
                <>
                  <p className="font-semibold">
                    {phase === "pending" ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                        Waiting for validator consensus...
                      </span>
                    ) : (
                      "Still processing on-chain ⏳"
                    )}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs">tx: {submitted.txHash}</p>
                  {submitted.recordId && (
                    <p className="break-all font-mono text-[10px] opacity-70">
                      record_id: {submitted.recordId}
                    </p>
                  )}
                  {phase === "deferred" && (
                    <p className="mt-1 text-xs">
                      Studionet consensus can take a while. The record will appear in{" "}
                      <a href="/records" className="font-semibold underline">
                        My Records
                      </a>{" "}
                      once validators finish — nothing is lost.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={!formValid}
          >
            {busy ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                {phase === "signing" ? "Waiting for wallet signature..." : "Consensus in progress..."}
              </>
            ) : (
              <>Notarize Claim with 🐾</>
            )}
          </Button>
        </form>
      </div>

      {recentRecords.length > 0 && (
        <div className="relative mt-12">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-candy-900">
            <PawPrint className="h-5 w-5 text-candy-500" />
            My Recent Records
          </h2>
          <div className="space-y-4">
            {recentRecords.map((record) => (
              <div
                key={`${record.record_id ?? record.__index}`}
                className="rounded-2xl border-2 border-candy-100 bg-card p-4 transition-all hover:border-candy-300"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-candy-900">
                    {record.claim}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border-2 px-3 py-0.5 text-xs font-bold ${
                      verdictStyles[record.verdict] ??
                      "bg-gray-100 text-gray-600 border-gray-300"
                    }`}
                  >
                    {record.verdict}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {record.source_url}
                </p>
                <p className="mt-2 text-xs">
                  Confidence:{" "}
                  <span
                    className={
                      safeConfidence(record.confidence) >= 0.8
                        ? "font-bold text-emerald-600"
                        : safeConfidence(record.confidence) >= 0.5
                        ? "font-bold text-amber-600"
                        : "font-bold text-rose-600"
                    }
                  >
                    {safeConfidence(record.confidence).toFixed(2)}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
