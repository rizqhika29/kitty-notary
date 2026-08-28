import * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "default" | "lg" | "icon";
}

export function Button({
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
        {
          default:
            "bg-gradient-to-r from-candy-500 to-lilac-500 text-white shadow-glow-pink hover:from-candy-600 hover:to-lilac-600 hover:-translate-y-0.5",
          outline:
            "border-2 border-candy-300 bg-card text-candy-700 hover:bg-candy-100 hover:border-candy-400",
          ghost: "hover:bg-secondary hover:text-foreground text-muted-foreground",
          destructive:
            "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        }[variant],
        {
          sm: "h-9 px-4 text-xs",
          default: "h-10 px-5 py-2",
          lg: "h-12 px-8 text-base",
          icon: "h-10 w-10",
        }[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}