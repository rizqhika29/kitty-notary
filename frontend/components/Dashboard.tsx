"use client";

import { useState, useEffect } from "react";
import { getRecord, getRecordCount } from "@/lib/contract";
import { cn } from "@/lib/utils";
import { KittyCartoon, PawPrint } from "@/components/cat";

const verdictBadge: Record<string, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-700 border-emerald-300",
  NOT_VERIFIED: "bg-rose-100 text-rose-700 border-rose-300",
  UNCERTAIN: "bg-amber-100 text-amber-700 border-amber-300",
};

export default function Dashboard() {
  const [count, setCount] = useState(0);
  const [latestRecords, setLatestRecords] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const total = Number(await getRecordCount()) || 0;
        setCount(total);

        const records = new Map<string, string>();
        const fetchCount = Math.min(total, 5);
        for (let i = 0; i < fetchCount; i++) {
          const raw = await getRecord(i);
          if (raw && raw !== "{}") {
            const parsed = JSON.parse(raw);
            records.set(String(i), parsed.verdict || "UNKNOWN");
          }
        }
        setLatestRecords(records);
      } catch (err) {
        console.error("Dashboard fetch error", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  const verified = Array.from(latestRecords.values()).filter(
    (v) => v === "VERIFIED"
  ).length;

  return (
    <section className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-16 -left-24 h-80 w-80 rounded-full bg-blob-pink animate-float-slow" />
      <div className="relative text-center sm:text-left">
        <span className="inline-flex items-center gap-2 rounded-full border border-candy-200 bg-card px-4 py-1.5 text-sm font-semibold text-candy-700 shadow-sm">
          <PawPrint className="h-4 w-4" />
          Contract state
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Your <span className="text-gradient-pink">Litter</span> of Records
        </h1>
        <p className="mt-2 text-muted-foreground">
          Overview of on-chain notarization state.
        </p>
      </div>

      <div className="relative mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-[1.5rem] border-2 border-candy-100 bg-card p-6 transition-all hover:border-candy-300 hover:shadow-glow-pink">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              Total Records
            </p>
            <PawPrint className="h-5 w-5 text-candy-400" />
          </div>
          <p className="mt-2 text-4xl font-bold text-candy-900">
            {loading ? <span className="animate-pulse">...</span> : count}
          </p>
        </div>
        <div className="rounded-[1.5rem] border-2 border-candy-100 bg-card p-6 transition-all hover:border-candy-300 hover:shadow-glow-pink">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              Verified (recent)
            </p>
            <PawPrint className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-4xl font-bold text-emerald-600">
            {loading ? <span className="animate-pulse">...</span> : verified}
          </p>
        </div>
        <div className="rounded-[1.5rem] border-2 border-candy-100 bg-card p-6 transition-all hover:border-candy-300 hover:shadow-glow-pink">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              Contract Address
            </p>
            <PawPrint className="h-5 w-5 text-lilac-400" />
          </div>
          <p className="mt-2 break-all font-mono text-sm font-medium text-candy-900">
            {loading
              ? "..."
              : (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "not set")}
          </p>
        </div>
      </div>

      {latestRecords.size > 0 && (
        <div className="relative mt-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-candy-900">
            <PawPrint className="h-4 w-4 text-candy-500" />
            Recent Records
          </h2>
          <div className="space-y-3">
            {Array.from(latestRecords.entries())
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([index, verdict]) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-2xl border-2 border-candy-100 bg-card p-4 transition-all hover:border-candy-300"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-candy-900">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-candy-100 to-lilac-100 text-xs font-bold text-candy-600">
                      {Number(index) + 1}
                    </span>
                    Record #{index}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border-2 px-3 py-0.5 text-xs font-bold",
                      verdictBadge[verdict] ?? "bg-gray-100 text-gray-600 border-gray-300"
                    )}
                  >
                    {verdict}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {!loading && latestRecords.size === 0 && (
        <div className="relative mt-8 rounded-2xl border-2 border-dashed border-white/60 bg-white/50 p-10 text-center backdrop-blur">
          <div className="mx-auto h-28 w-28 animate-bob">
            <KittyCartoon className="h-full w-full drop-shadow-lg" />
          </div>
          <p className="mt-4 text-muted-foreground">
            No records yet. Ready to make some catnip-grade history? 🐾
          </p>
        </div>
      )}
    </section>
  );
}