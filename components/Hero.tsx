import { Button } from "@/components/ui/Button";
import { ArrowRight, PawPrint } from "lucide-react";
import Link from "next/link";
import { KittyCartoon, PawPrint as Paw } from "@/components/cat";

export default function Hero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-[28rem] w-[28rem] rounded-full bg-blob-pink animate-float-slow" />
        <div className="absolute -right-24 top-20 h-[28rem] w-[28rem] rounded-full bg-blob-lilac animate-float-slower" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-around opacity-30">
        <Paw className="h-8 w-8 text-candy-400 animate-float-slow" />
        <Paw className="h-6 w-6 text-lilac-400 animate-float-slower" />
        <Paw className="h-10 w-10 text-candy-300 animate-float-slow" />
        <Paw className="h-7 w-7 text-lilac-500 animate-float-slower" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          {/* left: copy */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-1.5 text-sm font-semibold text-candy-700 shadow-sm backdrop-blur">
              <PawPrint className="h-4 w-4 text-candy-500" />
              Meow-diated on GenLayer
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
              Truth,{" "}
              <span className="text-gradient-pink">purr-ified</span>
              <br />
              on-chain
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-candy-900/70 lg:mx-0">
              KittyNotary uses decentralized AI validator consensus on GenLayer
              to verify whether an online event actually happened. No oracles, no
              intermediaries — just whisker-trustworthy adjudication.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Link href="/submit">
                <Button size="lg">
                  Submit a Claim
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/records">
                <Button variant="outline" size="lg">
                  View Records
                </Button>
              </Link>
            </div>
          </div>

          {/* right: animated cat */}
          <div className="relative flex justify-center">
            <div className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute right-8 top-0 h-72 w-72 rounded-full bg-blob-lilac" />
              <div className="absolute bottom-0 left-8 h-64 w-64 rounded-full bg-blob-pink" />
            </div>
            <div className="animate-meow-float">
              <KittyCartoon className="h-72 w-72 sm:h-96 sm:w-96 drop-shadow-2xl" />
            </div>

            {/* floating meow bubble */}
            <div
              className="absolute bottom-24 -right-2 animate-float-slow rounded-2xl rounded-bl-none border border-candy-200 bg-white/90 px-5 py-3 shadow-glow-pink backdrop-blur sm:bottom-28 sm:right-4"
            >
              <p className="text-sm font-bold text-candy-700">
                Meow! 🐾 Verified!
              </p>
              <p className="text-xs text-muted-foreground">
                consensus +9 confidence
              </p>
            </div>

            {/* tiny heart */}
            <div className="absolute right-0 top-16 animate-float-slower text-2xl">
              💗
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}