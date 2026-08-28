"use client";

import { useState, useEffect, useCallback } from "react";
import { getContractInfo, getRecordCount } from "@/lib/contract";
import type { ContractState } from "@/types";

export function useContract() {
  const [state, setState] = useState<ContractState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    try {
      setLoading(true);
      const info = await getContractInfo();
      const count = await getRecordCount();
      if (info) {
        setState({ address: info.address, count: Number(count) || 0 });
      } else {
        setState(null);
      }
      setError(null);
    } catch (err) {
      setError("Failed to fetch contract info");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  return { state, loading, error, refetch: fetchInfo };
}