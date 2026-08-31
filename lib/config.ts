export const env = {
  NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "",
  NEXT_PUBLIC_RPC_ENDPOINT:
    process.env.NEXT_PUBLIC_RPC_ENDPOINT || "http://localhost:4000/api",
  NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK || "studionet",
};