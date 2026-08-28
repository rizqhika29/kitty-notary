"use client";

import * as ToastPrimitives from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";
import { createContext, useContext, useState, useCallback } from "react";

interface ToastProps {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToastContextType {
  toast: (props: ToastProps) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<
    Array<{ id: string; title: string; description?: string; variant?: string }>
  >([]);

  const toast = useCallback(
    ({ title, description, variant }: ToastProps) => {
      const id = Math.random().toString(36).substr(2, 9);
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm rounded-2xl border-2 p-4 shadow-glow-pink ${
              t.variant === "destructive"
                ? "bg-red-50 border-red-200"
                : "bg-card border-candy-200"
            }`}
          >
            <p className="text-sm font-bold text-candy-900">{t.title}</p>
            {t.description && (
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {t.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { toast: () => {} };
  }
  return ctx;
}

export { ToastPrimitives };