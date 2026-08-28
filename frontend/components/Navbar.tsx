"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Send, Table2, PawPrint, Globe, Cat } from "lucide-react";
import WalletConnect from "@/components/WalletConnect";
import { CatFace } from "@/components/cat";

const navItems = [
  { href: "/", label: "Home", icon: Cat },
  { href: "/submit", label: "Submit Claim", icon: Send },
  { href: "/records", label: "My Records", icon: Table2 },
  { href: "/explorer", label: "Explorer", icon: Globe },
  { href: "/dashboard", label: "Dashboard", icon: PawPrint },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-candy-200 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2.5 font-bold text-xl"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-candy-400 to-lilac-400 shadow-glow-pink transition-transform group-hover:-rotate-6">
              <CatFace className="h-8 w-8" />
            </span>
            <span className="bg-gradient-to-r from-candy-600 to-lilac-600 bg-clip-text text-transparent">
              KittyNotary
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-all",
                    isActive
                      ? "bg-gradient-to-r from-candy-100 to-lilac-100 text-candy-700 shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
            <WalletConnect />
          </div>
        </div>
      </div>
    </nav>
  );
}