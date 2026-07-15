"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { border: string; dot: string }> = {
  success: { border: "border-success/50", dot: "var(--color-success)" },
  error: { border: "border-danger/50", dot: "var(--color-danger)" },
  info: { border: "border-border", dot: "var(--color-accent)" },
};

/** Non-blocking toast notifications, bottom-right, auto-dismissing (F5.1). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`animate-fade-in-up flex items-center gap-2.5 rounded-lg border ${VARIANT_STYLES[t.variant].border} bg-panel px-4 py-3 text-left text-[13px] text-text shadow-lg shadow-black/40 max-w-sm`}
          >
            <span
              className="h-2 w-2 flex-none rounded-full"
              style={{ backgroundColor: VARIANT_STYLES[t.variant].dot }}
            />
            <span>{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
