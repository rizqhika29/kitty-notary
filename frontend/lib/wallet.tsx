"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { decodeFunctionData, toFunctionSelector, type Address } from "viem";
import { getContractAddress } from "@/lib/contract";

export interface WalletChainConfig {
  chainId: string;
  chainName: string;
  rpcUrls: [string];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls: [string] | string[];
}

export const STUDIONET_CHAIN: WalletChainConfig = {
  chainId: "0xf22f", // 61999
  chainName: "GenLayer Studio Network",
  rpcUrls: ["https://studio.genlayer.com/api"],
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  blockExplorerUrls: ["https://genlayer-explorer.vercel.app"],
};

/** Consensus entrypoints a KittyNotary write may legitimately target. */
const CONSENSUS_MAIN_ADDRESS = "0xb7278a61aa25c888815afc32ad3cc52ff24fe575";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** addTransaction as served by studionet's runtime consensus ABI: FIVE
 *  parameters (no _validUntil). Its selector is 0x27241a99. */
const ADD_TRANSACTION_ABI = [
  {
    type: "function",
    name: "addTransaction",
    stateMutability: "payable",
    inputs: [
      { name: "_sender", type: "address" },
      { name: "_recipient", type: "address" },
      { name: "_numOfInitialValidators", type: "uint256" },
      { name: "_maxRotations", type: "uint256" },
      { name: "_calldata", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const EXPECTED_SELECTOR = toFunctionSelector(ADD_TRANSACTION_ABI[0]);

/** Guard against blind signing: refuse payloads that do not decode to an
 *  addTransaction call attributing the record to `expectedSender` and
 *  targeting our deployed contract via a known consensus entrypoint. */
export function verifyAddTransactionPayload(
  tx: { to: string; data: string },
  expectedSender: string
): void {
  const target = tx.to?.toLowerCase();
  if (target !== CONSENSUS_MAIN_ADDRESS && target !== ZERO_ADDRESS) {
    throw new Error(
      `Refusing to sign: unexpected transaction target ${tx.to}. Expected the GenLayer consensus contract.`
    );
  }

  const data = tx.data ?? "";
  if (!/^0x[0-9a-fA-F]+$/.test(data) || data.length < 10 + 64 * 6) {
    throw new Error("Refusing to sign: malformed transaction payload.");
  }
  if (data.slice(0, 10).toLowerCase() !== EXPECTED_SELECTOR) {
    throw new Error(
      "Refusing to sign: payload is not an addTransaction call from KittyNotary."
    );
  }

  const decoded = decodeFunctionData({
    abi: ADD_TRANSACTION_ABI,
    data: data as `0x${string}`,
  });
  if (decoded.functionName !== "addTransaction") {
    throw new Error("Refusing to sign: unexpected decoded function.");
  }
  const [sender, recipient, numValidators, maxRotations] = decoded.args as [
    Address,
    Address,
    bigint,
    bigint,
    `0x${string}`,
  ];

  if (sender.toLowerCase() !== expectedSender.toLowerCase()) {
    throw new Error(
      "Refusing to sign: payload sender does not match the connected wallet."
    );
  }
  if (recipient.toLowerCase() !== getContractAddress().toLowerCase()) {
    throw new Error(
      "Refusing to sign: payload targets an unknown contract instead of the KittyNotary records contract."
    );
  }
  if (numValidators === BigInt(0) || numValidators > BigInt(25) || maxRotations > BigInt(5)) {
    throw new Error("Refusing to sign: unusual consensus parameters in payload.");
  }
}

interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  ensureStudionet: () => Promise<void>;
  sendTransaction: (tx: { to: string; data: string; value?: string }) => Promise<string>;
}

const WalletContext = createContext<WalletState | null>(null);

function getEthereum(): any {
  if (typeof window === "undefined") return null;
  const ethereum = (window as any).ethereum;
  if (!ethereum) return null;
  // support both MetaMask's window.ethereum and window.ethereum.providers
  const providers = ethereum.providers;
  if (Array.isArray(providers)) {
    return providers.find((p: any) => p && p.isMetaMask) ?? ethereum;
  }
  return ethereum;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const refreshChainId = useCallback(async () => {
    try {
      const w = getEthereum();
      if (!w) return;
      const hex = await w.request({ method: "eth_chainId" });
      setChainId(parseInt(hex, 16));
    } catch {
      // ignore
    }
  }, []);

  const ensureStudionet = useCallback(async () => {
    const w = getEthereum();
    if (!w) throw new Error("Please install MetaMask or another EVM wallet");
    const hex = await w.request({ method: "eth_chainId" });
    if (hex === STUDIONET_CHAIN.chainId) return;
    try {
      await w.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: STUDIONET_CHAIN.chainId }],
      });
    } catch (err: any) {
      if (err?.code === 4902) {
        await w.request({
          method: "wallet_addEthereumChain",
          params: [STUDIONET_CHAIN],
        });
      } else {
        throw err;
      }
    }
    await refreshChainId();
  }, [refreshChainId]);

  const connect = useCallback(async () => {
    const w = getEthereum();
    if (!w) {
      alert("Please install MetaMask or another EVM wallet");
      return null;
    }
    try {
      const accounts = await w.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) return null;
      setAddress(accounts[0] ?? null);
      await ensureStudionet();
      await refreshChainId();
      return accounts[0] ?? null;
    } catch (err) {
      console.error("Wallet connection failed", err);
      throw err;
    }
  }, [ensureStudionet, refreshChainId]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  const sendTransaction = useCallback(
    async (tx: { to: string; data: string; value?: string }) => {
      const w = getEthereum();
      if (!w) throw new Error("Please install MetaMask or another EVM wallet");
      await ensureStudionet();
      const accounts = await w.request({ method: "eth_accounts" });
      const from = accounts[0] ?? (await connect());
      if (!from) throw new Error("No wallet account available");

      // Never ask the wallet to sign a payload we have not verified.
      verifyAddTransactionPayload(tx, from);

      const hash = await w.request({
        method: "eth_sendTransaction",
        params: [
          {
            from,
            to: tx.to,
            data: tx.data,
            value: tx.value ?? "0x0",
            chainId: STUDIONET_CHAIN.chainId,
            // studionet reports baseFee 0; these match genlayer-py's working
            // fee config and stop MetaMask from rejecting zero-gas txs.
            maxFeePerGas: "0x77359400", // 2 gwei
            maxPriorityFeePerGas: "0x77359400", // 2 gwei
          },
        ],
      });
      setAddress(from);
      await refreshChainId();
      return String(hash);
    },
    [ensureStudionet, connect, refreshChainId]
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        isConnected: !!address,
        connect,
        disconnect,
        ensureStudionet,
        sendTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}