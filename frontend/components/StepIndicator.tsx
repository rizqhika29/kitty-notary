import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep?: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps = {}) {
  const steps = [
    { number: 1, title: "Submit", desc: "Fill claim + URL" },
    { number: 2, title: "Fetch", desc: "Contract fetches source" },
    { number: 3, title: "Validate", desc: "AI validators evaluate" },
    { number: 4, title: "Record", desc: "Result stored on-chain" },
  ];

  return (
    <div className="relative">
      <div className="absolute top-6 right-12 left-12 hidden h-0.5 rounded-full bg-gradient-to-r from-candy-200 via-lilac-200 to-candy-200 sm:block" />
      <div className="space-y-8 sm:grid sm:grid-cols-4 sm:gap-8 sm:space-y-0">
        {steps.map((step) => (
          <div key={step.number} className="relative text-center">
            <div
              className={cn(
                "mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold shadow-sm",
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                currentStep && currentStep >= step.number
                  ? "border-candy-400 bg-gradient-to-br from-candy-400 to-lilac-400 text-white shadow-glow-pink"
                  : "border-candy-200 bg-white/80 text-candy-600 backdrop-blur"
              )}
            >
              {step.number}
            </div>
            <h3 className="mt-4 font-bold text-candy-900">{step.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}