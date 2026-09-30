import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  // Rendered straight into <body>. A card with a blur effect (our "card"/
  // "surface" style) traps position:fixed children in Chrome, which squeezed
  // any dialog opened from inside a card into that card's box instead of the
  // full screen. `open` only turns true after a click, so `document` exists.
  return createPortal(
    <div className="modal-layer">
      <div className="modal-scrim" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={title} className="modal">
        <div className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="modal-close">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
