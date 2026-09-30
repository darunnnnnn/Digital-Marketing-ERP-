import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./Toast.css";

/**
 * Brief confirmations and failures.
 *
 * The old build reloaded the page after every change, so "it saved" was implied
 * by the fresh page. Nothing reloads now, so an action that changes something
 * says so here instead — and a failed write says why rather than looking like
 * nothing happened.
 */

type Toast = { id: number; message: string; tone: "ok" | "error" };

type ToastApi = {
  /** Something worked. */
  say: (message: string) => void;
  /** Something didn't. Stays on screen twice as long. */
  warn: (message: string) => void;
};

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const push = useCallback((message: string, tone: Toast["tone"]) => {
    const id = next.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      tone === "error" ? 6000 : 3000,
    );
  }, []);

  const api = useRef<ToastApi>({
    say: (m) => push(m, "ok"),
    warn: (m) => push(m, "error"),
  }).current;

  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-layer" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.tone}`}>
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
