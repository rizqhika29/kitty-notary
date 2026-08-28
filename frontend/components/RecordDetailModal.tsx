"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { safeConfidence, safeSourceHref, formatAddress } from "@/lib/utils";
import { KittyCartoon } from "@/components/cat";
import type { NotarizationRecord } from "@/types";

const verdictStyles: Record<string, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-700 border-emerald-300",
  NOT_VERIFIED: "bg-rose-100 text-rose-700 border-rose-300",
  UNCERTAIN: "bg-amber-100 text-amber-700 border-amber-300",
};

interface RecordDetailModalProps {
  record: NotarizationRecord | null;
  onClose: () => void;
}

export default function RecordDetailModal({ record, onClose }: RecordDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (record) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [record, onClose]);

  if (!record) return null;

  const conf = safeConfidence(record.confidence);
  const confPct = Math.round(conf * 100);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border-2 border-candy-200 bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-candy-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8">
              <KittyCartoon className="h-full w-full" />
            </div>
            <h2 className="text-lg font-bold text-candy-900">Claim Detail</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-candy-500 hover:bg-candy-100 hover:text-candy-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {/* Claim */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-candy-500">Claim</label>
            <p className="text-sm leading-relaxed text-candy-900">{record.claim}</p>
          </div>

          {/* Source URL */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-candy-500">Source</label>
            {safeSourceHref(record.source_url) ? (
              <a
                href={record.source_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="break-all text-sm font-medium text-candy-600 underline hover:text-candy-800"
              >
                {record.source_url}
              </a>
            ) : (
              <span className="break-all text-sm text-muted-foreground">{record.source_url}</span>
            )}
          </div>

          {/* Verdict + Confidence row */}
          <div className="flex items-center gap-6">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-candy-500">Verdict</label>
              <span
                className={`inline-flex items-center rounded-full border-2 px-4 py-1 text-sm font-bold ${
                  verdictStyles[record.verdict] ?? "bg-gray-100 text-gray-600 border-gray-300"
                }`}
              >
                {record.verdict}
              </span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-candy-500">Confidence</label>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-32 overflow-hidden rounded-full bg-candy-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      conf >= 0.8
                        ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                        : conf >= 0.5
                        ? "bg-gradient-to-r from-amber-400 to-amber-500"
                        : "bg-gradient-to-r from-rose-400 to-rose-500"
                    }`}
                    style={{ width: `${confPct}%` }}
                  />
                </div>
                <span
                  className={`text-sm font-bold ${
                    conf >= 0.8 ? "text-emerald-600" : conf >= 0.5 ? "text-amber-600" : "text-rose-600"
                  }`}
                >
                  {confPct}%
                </span>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-candy-500">AI Reasoning</label>
            <p className="whitespace-pre-wrap rounded-2xl border border-candy-100 bg-candy-50/50 p-4 text-sm leading-relaxed text-candy-800">
              {record.reason || "No reasoning provided."}
            </p>
          </div>

          {/* Metadata row */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="mb-1 block font-bold uppercase tracking-wide text-candy-500">Requester</label>
              <p className="font-mono break-all text-muted-foreground">{formatAddress(record.requester)}</p>
            </div>
            {record.record_id && (
              <div>
                <label className="mb-1 block font-bold uppercase tracking-wide text-candy-500">Record ID</label>
                <p className="font-mono break-all text-muted-foreground">{record.record_id}</p>
              </div>
            )}
            {record.timestamp && (
              <div>
                <label className="mb-1 block font-bold uppercase tracking-wide text-candy-500">Timestamp</label>
                <p className="text-muted-foreground">
                  {typeof record.timestamp === "number"
                    ? new Date(record.timestamp * 1000).toLocaleString()
                    : record.timestamp}
                </p>
              </div>
            )}
            {record.__index != null && (
              <div>
                <label className="mb-1 block font-bold uppercase tracking-wide text-candy-500">On-Chain Index</label>
                <p className="text-muted-foreground">#{record.__index}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-candy-100 px-6 py-4">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
