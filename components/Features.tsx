import { Globe, FileText, Brain, Lock, Clock, Users } from "lucide-react";
import { PawPrint } from "@/components/cat";

const features = [
  {
    icon: Globe,
    title: "Web-Aware",
    description:
      "Contracts fetch live web data directly, no external oracle needed.",
  },
  {
    icon: Brain,
    title: "AI Judgment",
    description:
      "LLM evaluates whether a claim is supported by source evidence.",
  },
  {
    icon: Users,
    title: "Decentralized Consensus",
    description:
      "Multiple AI validators independently verify and reach agreement.",
  },
  {
    icon: Lock,
    title: "Immutable Records",
    description:
      "Every notarization is permanently stored on-chain with full traceability.",
  },
  {
    icon: Clock,
    title: "Fast Resolution",
    description:
      "Justice in minutes, not months. Consensus reaches finality quickly.",
  },
  {
    icon: FileText,
    title: "Structured Output",
    description:
      "Verdicts are structured (VERIFIED, NOT_VERIFIED, UNCERTAIN) with confidence scores.",
  },
];

export default function Features() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-candy-600">
            <PawPrint className="h-4 w-4" />
            Why KittyNotary?
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Nine lives of <span className="text-gradient-pink">trust</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            GenLayer fills the gap that every other chain leaves — trustless
            adjudication for events that require judgment, not just code.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative rounded-[1.5rem] border border-candy-100 bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:border-candy-300 hover:shadow-glow-pink"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-candy-100 to-lilac-100 text-candy-600 transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-candy-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}