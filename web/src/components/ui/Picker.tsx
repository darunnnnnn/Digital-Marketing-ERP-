import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import "./Picker.css";

export type PickerOption = {
  value: string;
  label: string;
  /** A second line under the label — a role, a client, whatever disambiguates. */
  meta?: string;
  disabled?: boolean;
};

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Tick() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/** Where the menu goes, in viewport coordinates. */
type Place = { left: number; top: number; width: number; drop: "down" | "up" };

/**
 * A dropdown that belongs to this app rather than to the operating system.
 *
 * A native <select> can be styled shut but not open: the list it pops is drawn
 * by the OS, in its own font, with its own blue highlight, and on a page built
 * out of frosted white and evergreen that list always reads as something from
 * another program. So the list here is ours — a button and a listbox, with the
 * keyboard behaviour people expect from the native one kept intact.
 *
 * The menu is portalled and positioned against the viewport, because these sit
 * inside panels that scroll and clip; it follows its button while open, and
 * flips above it when there is no room below.
 */
export function Picker({
  value,
  defaultValue,
  options,
  onChange,
  name,
  placeholder = "Choose…",
  clearable = true,
  label,
  id,
  disabled,
  className,
  menuClassName,
}: {
  /** Controlled. Leave it out and the picker keeps its own value. */
  value?: string;
  defaultValue?: string;
  options: PickerOption[];
  onChange?: (value: string) => void;
  /** Set it inside a plain <form>: the value posts through a hidden input. */
  name?: string;
  /** Shown when nothing is chosen. Picking it back clears the value. */
  placeholder?: string;
  /** False where an empty value is not a valid answer, like a priority. */
  clearable?: boolean;
  /** For screen readers, when no visible <label> points at this. */
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState(defaultValue ?? "");
  const current = value ?? own;
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The placeholder is a real row, because picking it is how you clear the
  // filter — except where empty isn't an answer, and then it is only the hint
  // on the closed button.
  const rows: PickerOption[] = clearable
    ? [{ value: "", label: placeholder }, ...options]
    : options;
  const chosen = options.find((o) => o.value === current);

  function position() {
    const b = buttonRef.current?.getBoundingClientRect();
    if (!b) return;
    const below = window.innerHeight - b.bottom;
    const drop: Place["drop"] = below < 240 && b.top > below ? "up" : "down";
    setPlace({
      left: b.left,
      top: drop === "down" ? b.bottom + 6 : b.top - 6,
      width: b.width,
      drop,
    });
  }

  // Measured before paint, so the menu never flashes in the wrong corner.
  useLayoutEffect(() => {
    if (open) position();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function away(e: MouseEvent) {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    }
    // Any scroll under an open menu moves the button, so follow it; a resize
    // can change which way it should drop.
    function follow() {
      position();
    }

    document.addEventListener("mousedown", away);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open]);

  function openAt(index: number) {
    setActive(index < 0 ? 0 : index);
    setOpen(true);
  }

  function pick(option: PickerOption) {
    if (option.disabled) return;
    if (value === undefined) setOwn(option.value);
    onChange?.(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function step(delta: number) {
    setActive((i) => {
      let next = i;
      // Step over anything disabled rather than landing on it.
      for (let n = 0; n < rows.length; n++) {
        next = (next + delta + rows.length) % rows.length;
        if (!rows[next].disabled) return next;
      }
      return i;
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        if (!open) openAt(rows.findIndex((o) => o.value === current));
        else step(e.key === "ArrowDown" ? 1 : -1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) pick(rows[active]);
        else openAt(rows.findIndex((o) => o.value === current));
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          setActive(rows.length - 1);
        }
        break;
    }
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}

      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        disabled={disabled}
        className={cn("picker", open && "picker-open", !chosen && "picker-empty", className)}
        onClick={() => (open ? setOpen(false) : openAt(rows.findIndex((o) => o.value === current)))}
        onKeyDown={onKeyDown}
      >
        <span className="picker-value truncate">{chosen?.label ?? placeholder}</span>
        <span className="picker-chevron" aria-hidden>
          <Chevron />
        </span>
      </button>

      {open &&
        place &&
        createPortal(
          <div
            ref={menuRef}
            className={cn("picker-menu", place.drop === "up" && "picker-menu-up", menuClassName)}
            style={{
              left: place.left,
              width: place.width,
              ...(place.drop === "down"
                ? { top: place.top }
                : { bottom: window.innerHeight - place.top }),
            }}
          >
            <ul role="listbox" aria-label={label} className="picker-list" tabIndex={-1}>
              {rows.map((o, i) => {
                const selected = o.value === current;
                return (
                  <li key={o.value || "__none"}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={o.disabled}
                      className={cn(
                        "picker-option",
                        i === active && "picker-option-active",
                        selected && "picker-option-on",
                        !o.value && "picker-option-none",
                      )}
                      // Pointer, not hover: the keyboard owns `active`, and the
                      // mouse taking it over on entry is what people expect.
                      onMouseMove={() => setActive(i)}
                      onClick={() => pick(o)}
                    >
                      <span className="picker-option-text">
                        <span className="truncate">{o.label}</span>
                        {o.meta && <span className="picker-option-meta truncate">{o.meta}</span>}
                      </span>
                      {selected && (
                        <span className="picker-tick" aria-hidden>
                          <Tick />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
