"use client";

import { useState, useEffect, useCallback } from "react";
import { batchViews } from "@/lib/contract";
import { useWallet } from "@/lib/wallet";
import { safeConfidence, safeSourceHref } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { KittyCartoon, PawPrint } from "@/components/cat";
import RecordDetailModal from "@/components/RecordDetailModal";
import type { NotarizationRecord } from "@/types";

const verdictBadge: Record<string, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-700 border-emerald-300",
  NOT_VERIFIED: "bg-rose-100 text-rose-700 border-rose-300",
  UNCERTAIN: "bg-amber-100 text-amber-700 border-amber-300",
};

const pageSize = 10;
const BATCH_SIZE = 12;

interface RecordsTableProps {
  /** "mine" filters to the connected wallet's records; "all" shows everything with filter tabs. */
  mode?: "mine" | "all";
}

function parseIndices(raw: unknown): number[] {
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

async function fetchRecordBatch(indices: number[]): Promise<NotarizationRecord[]> {
  const out: NotarizationRecord[] = [];
  for (let offset = 0; offset < indices.length; offset += BATCH_SIZE) {
    const chunk = indices.slice(offset, offset + BATCH_SIZE);
    const results = await batchViews(
      chunk.map((i) => ({ method: "get_record", args: [i] }))
    );
    results.forEach((raw, j) => {
      if (!raw || raw === "{}") return;
      try {
        out.push({ ...(JSON.parse(String(raw)) as NotarizationRecord), __index: chunk[j] });
      } catch {
        // skip malformed
      }
    });
  }
  return out;
}

export default function RecordsTable({ mode = "all" }: RecordsTableProps) {
  const { address } = useWallet();
  const [records, setRecords] = useState<NotarizationRecord[]>([]);
  const [requesters, setRequesters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("all");
  const [selectedRecord, setSelectedRecord] = useState<NotarizationRecord | null>(null);

  const normalizedAddress = address?.toLowerCase() ?? "";

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (mode === "mine" && !normalizedAddress) {
        setRecords([]);
        setCount(0);
        return;
      }

      const head = await batchViews([
        { method: "get_count" },
        { method: "get_records_by_requester", args: [normalizedAddress] },
      ]);
      const total = Number(head[0]) || 0;

      if (mode === "mine") {
        const indices = parseIndices(head[1]);
        setCount(indices.length);
        const start = Math.max(0, indices.length - (page + 1) * pageSize);
        const end = indices.length - page * pageSize;
        const slice = indices.slice(Math.max(0, start), Math.max(0, end)).reverse();
        setRecords(slice.length ? await fetchRecordBatch(slice) : []);
        return;
      }

      // mode === "all": newest first, one page of records per load
      setCount(total);
      const startIdx = Math.max(0, total - 1 - page * pageSize);
      const slice: number[] = [];
      for (let i = startIdx; i >= 0 && slice.length < pageSize; i--) slice.push(i);

      const fetched = slice.length ? await fetchRecordBatch(slice) : [];
      const requesterSet = new Set<string>();
      for (const r of fetched) requesterSet.add(r.requester.toLowerCase());
      setRequesters(Array.from(requesterSet));

      const filtered =
        tab === "all"
          ? fetched
          : fetched.filter((r) => r.requester.toLowerCase() === tab.toLowerCase());
      setRecords(filtered);
    } catch (err) {
      console.error("Failed to fetch records", err);
      setError(err instanceof Error ? err.message : "Failed to fetch records");
    } finally {
      setLoading(false);
    }
  }, [mode, normalizedAddress, page, tab]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-16 -right-24 h-80 w-80 rounded-full bg-blob-lilac animate-float-slower" />
      <div className="relative text-center sm:text-left">
        <span className="inline-flex items-center gap-2 rounded-full border border-candy-200 bg-card px-4 py-1.5 text-sm font-semibold text-candy-700 shadow-sm">
          <PawPrint className="h-4 w-4" />
          {count} records & counting
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          The <span className="text-gradient-pink">Scratchpad</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          {mode === "mine"
            ? "Your whisker-verified notarizations, forever on-chain."
            : "Every whisker-verified notarization, forever on-chain."}
        </p>
      </div>

      {mode === "all" && (
        <div className="relative mt-8 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTab("all")}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-all ${
              tab === "all"
                ? "border-candy-400 bg-gradient-to-r from-candy-400 to-lilac-400 text-white shadow-glow-pink"
                : "border-candy-200 bg-card text-candy-600 hover:border-candy-300"
            }`}
          >
            All
          </button>
          {normalizedAddress && (
            <button
              onClick={() => setTab(normalizedAddress)}
              className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-all ${
                tab === normalizedAddress
                  ? "border-candy-400 bg-gradient-to-r from-candy-400 to-lilac-400 text-white shadow-glow-pink"
                  : "border-candy-200 bg-card text-candy-600 hover:border-candy-300"
              }`}
            >
              Mine ({normalizedAddress.slice(0, 6)}...)
            </button>
          )}
          {requesters.map((req) => (
            <button
              key={req}
              onClick={() => setTab(req)}
              className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-all ${
                tab === req
                  ? "border-candy-400 bg-gradient-to-r from-candy-400 to-lilac-400 text-white shadow-glow-pink"
                  : "border-candy-200 bg-card text-candy-600 hover:border-candy-300"
              }`}
            >
              {req.slice(0, 6)}...{req.slice(-4)}
            </button>
          ))}
        </div>
      )}

      {mode === "mine" && !normalizedAddress && !loading ? (
        <div className="relative mt-8 rounded-2xl border-2 border-dashed border-white/60 bg-white/50 p-12 text-center backdrop-blur">
          <div className="mx-auto h-32 w-32 animate-bob">
            <KittyCartoon className="h-full w-full drop-shadow-lg" />
          </div>
          <p className="mt-4 text-muted-foreground">
            Connect your wallet to see your records.
          </p>
        </div>
      ) : loading ? (
        <div className="relative mt-8 flex items-center justify-center gap-3 rounded-2xl border border-candy-200 bg-card p-12 text-muted-foreground">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-candy-300 border-t-candy-500" />
          Loading the litter box...
        </div>
      ) : error ? (
        <div className="relative mt-8 rounded-2xl border-2 border-rose-200 bg-rose-50 p-10 text-center text-rose-700">
          {error}
        </div>
      ) : records.length === 0 ? (
        <div className="relative mt-8 rounded-2xl border-2 border-dashed border-white/60 bg-white/50 p-12 text-center backdrop-blur">
          <div className="mx-auto h-32 w-32 animate-bob">
            <KittyCartoon className="h-full w-full drop-shadow-lg" />
          </div>
          <p className="mt-4 text-muted-foreground">
            No records yet.{" "}
            <a href="/submit" className="font-semibold text-candy-600 underline">
              Submit your first claim
            </a>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="relative mt-8 overflow-hidden rounded-[1.5rem] border-2 border-candy-100 bg-card shadow-sm">
            <table className="min-w-full divide-y divide-candy-100">
              <thead className="bg-gradient-to-r from-candy-100 to-lilac-100">
                <tr>
                  {["#", "Claim", "Source", "Verdict", "Confidence", "Requester", ""].map(
                    (h, i) => (
                      <th
                        key={i}
                        className="px-4 py-3.5 text-left text-xs font-bold tracking-wide text-candy-700 uppercase"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-candy-100 bg-card">
                {records.map((record, i) => {
                  const idx = record.__index ?? count - page * pageSize - i;
                  return (
                    <tr key={i} className="transition-colors hover:bg-candy-50/60">
                      <td className="px-4 py-3 text-sm text-muted-foreground">{idx}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm font-semibold text-candy-900">
                        {record.claim}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-muted-foreground">
                        {safeSourceHref(record.source_url) ? (
                          <a
                            href={record.source_url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="text-candy-600 hover:underline"
                          >
                            {record.source_url.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          <span className="break-all">
                            {record.source_url.replace(/^https?:\/\//, "")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full border-2 px-3 py-0.5 text-xs font-bold ${
                            verdictBadge[record.verdict] ??
                            "bg-gray-100 text-gray-600 border-gray-300"
                          }`}
                        >
                          {record.verdict}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
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
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {record.requester.slice(0, 6)}...
                        {record.requester.slice(-4)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedRecord(record)}
                          className="inline-flex items-center gap-1 rounded-full border border-candy-300 bg-candy-50 px-3 py-1 text-xs font-semibold text-candy-700 transition-colors hover:border-candy-400 hover:bg-candy-100"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="relative mt-6 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <RecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </section>
  );
}
