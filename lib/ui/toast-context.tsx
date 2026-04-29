"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type ToastVariant = "info" | "error" | "success";

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
};

type ToastContextValue = {
  toasts: Toast[];
  showToast: (message: string, options?: { variant?: ToastVariant; duration?: number }) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      { variant = "info", duration = 3000 }: { variant?: ToastVariant; duration?: number } = {},
    ) => {
      const id = String(++counterRef.current);
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
      if (duration > 0) {
        window.setTimeout(() => dismissToast(id), duration);
      }
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
