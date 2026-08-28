"use client";

import { useWallet } from "@/lib/wallet";
import { formatAddress } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Cat } from "lucide-react";

export default function WalletConnect() {
  const { address, isConnected, connect, disconnect } = useWallet();

  if (isConnected && address) {
    return (
      <div className="ml-1 flex items-center gap-2 rounded-full border border-candy-200 bg-card py-1 pl-1 pr-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-candy-400 to-lilac-400 text-white">
          <Cat className="h-4 w-4" />
        </span>
        <span className="hidden text-xs font-mono font-medium text-muted-foreground sm:inline">
          {formatAddress(address)}
        </span>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="ml-1">
      <Button size="sm" onClick={connect}>
        Connect Wallet
      </Button>
    </div>
  );
}