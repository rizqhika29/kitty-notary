import { steps } from "@/lib/constants";
import { StepIndicator } from "@/components/StepIndicator";
import { PawPrint } from "@/components/cat";

export default function HowItWorks() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/40 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-candy-600">
            <PawPrint className="h-4 w-4" />
            The Catwalk
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            How it <span className="text-gradient-pink">happens</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Four simple steps to a paw-sitively verified, on-chain notarization.
          </p>
        </div>
        <div className="mt-16">
          <StepIndicator />
        </div>
      </div>
    </section>
  );
}