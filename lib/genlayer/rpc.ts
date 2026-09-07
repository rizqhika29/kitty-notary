/**
 * GenLayer JSON-RPC client.
 *
 * Wraps the GenLayer-specific RPC methods (gen_call, etc.)
 */

import { encodeCalldataObject, calldataDecode } from "./calldata";
import { toRlp, toHex } from "viem";

interface RpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

interface RpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

let rpcId = Date.now();
function nextId(): number {
  return rpcId++;
}

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const req: RpcRequest = {
    jsonrpc: "2.0",
    id: nextId(),
    method,
    params,
  };

  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "genlayer-ts/1.0",
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}: ${await res.text().catch(() => "unknown")}`);
  }

  const json: RpcResponse = await res.json();
  if (json.error) {
    throw new Error(`RPC error ${json.error.code}: ${json.error.message}`);
  }
  return json.result;
}

/**
 * Encode calldata for a contract call and serialize it as RLP.
 */
function encodeCallData(
  method: string,
  args: (string | number | boolean | null)[] = [],
  leaderOnly = false
): string {
  const encoded = encodeCalldataObject(method, args);
  const encodedHex = toHex(encoded);
  const leaderHex = leaderOnly ? "0x01" : "0x00";
  const rlpData = toRlp([encodedHex, leaderHex]);
  return rlpData;
}

/**
 * Read a contract value via gen_call.
 */
export async function genCall(
  rpcUrl: string,
  contractAddress: string,
  senderAddress: string,
  method: string,
  args: (string | number | boolean | null)[] = []
): Promise<unknown> {
  const data = encodeCallData(method, args);

  const result = await rpcCall(rpcUrl, "gen_call", [
    {
      type: "read",
      to: contractAddress,
      from: senderAddress,
      data,
      transaction_hash_variant: "latest-nonfinal",
    },
  ]);

  if (typeof result !== "string") {
    return result;
  }

  const resultHex = result.startsWith("0x") ? result : `0x${result}`;
  const resultBytes = hexToUint8Array(resultHex);
  const decoded = calldataDecode(resultBytes);
  return decoded.value;
}

/**
 * Build a transaction payload for MetaMask signing.
 * Returns {to, data, chainId, value} without signing.
 */
export function buildTransaction(
  contractAddress: string,
  senderAddress: string,
  method: string,
  args: (string | number | boolean | null)[] = []
): { to: string; data: string; chainId: number; value: string } {
  const calldataEncoded = encodeCallData(method, args, false);

  const { encodeAbiParameters, keccak256, toBytes, toHex } = require("viem");

  const addTxSignature =
    "addTransaction(address,address,uint256,uint256,bytes,uint256)";
  const selector = keccak256(toBytes(addTxSignature)).slice(0, 10);

  const abiParams = encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "bytes" },
      { type: "uint256" },
    ],
    [
      senderAddress as `0x${string}`,
      contractAddress as `0x${string}`,
      BigInt(5), // defaultNumberOfInitialValidators
      BigInt(3), // defaultConsensusMaxRotations
      calldataEncoded as `0x${string}`,
      BigInt(0), // validUntil
    ]
  );

  return {
    to: "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575",
    data: selector + abiParams.slice(2),
    chainId: 61999,
    value: "0x0",
  };
}

function hexToUint8Array(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.substr(i * 2, 2), 16);
  }
  return bytes;
}
