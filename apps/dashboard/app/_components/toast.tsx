"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export type ToastVariant = "error" | "success" | "info";

interface ToastRecord {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  // Errors stay up longer -- they're often longer sentences and the user
  // needs time to actually read them, not just notice a flash of color.
  error: 8000,
  success: 4500,
  info: 5500,
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(0);
  // The portal must render nothing on the server and on the client's first
  // pass (which React diffs against the server HTML) -- gating on mount via
  // an effect, rather than a synchronous `typeof document` check, avoids a
  // hydration mismatch from document.body gaining a child the SSR output
  // never had.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS[variant]);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      showError: (message: string) => showToast(message, "error"),
      showSuccess: (message: string) => showToast(message, "success"),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {isMounted
        ? createPortal(
            <div className="toast-stack" role="status" aria-live="polite">
              {toasts.map((toast) => (
                <div key={toast.id} className={`toast toast-${toast.variant}`}>
                  <span>{toast.message}</span>
                  <button type="button" className="toast-dismiss" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}
