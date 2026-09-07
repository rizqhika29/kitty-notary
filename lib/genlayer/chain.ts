/**
 * GenLayer Studionet chain configuration.
 */

export const STUDIONET = {
  id: 61999,
  name: "GenLayer Studio Network",
  rpcUrl: "https://studio.genlayer.com/api",
  consensusMainContract: "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575",
  defaultNumberOfInitialValidators: 5,
  defaultConsensusMaxRotations: 3,
};

export const CONSENSUS_MAIN_ABI = [
  {
    inputs: [
      { name: "_sender", type: "address" },
      { name: "_recipient", type: "address" },
      { name: "_numOfInitialValidators", type: "uint256" },
      { name: "_maxRotations", type: "uint256" },
      { name: "_calldata", type: "bytes" },
      { name: "_validUntil", type: "uint256" },
    ],
    name: "addTransaction",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;
