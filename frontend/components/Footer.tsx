import { PawPrint } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-candy-200 bg-secondary/40 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <PawPrint className="h-5 w-5 text-candy-500" />
            <span className="font-bold text-candy-700">KittyNotary</span>
            <span className="text-sm text-muted-foreground">
              — whisker-approved on-chain truth.
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Notarized with 🐾 decentralized AI validators on GenLayer
          </p>
        </div>
      </div>
    </footer>
  );
}