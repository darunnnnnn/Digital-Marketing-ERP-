"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { IconSearch } from "@/components/icons";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "archived", label: "Archived" },
];

export function ClientToolbar({ counts }: { counts: Record<string, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const status = params.get("status") ?? "all";
  const [query, setQuery] = useState(params.get("q") ?? "");

  // Debounce so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (query === current) return;

    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query) next.set("q", query);
      else next.delete("q");
      startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
    }, 250);

    return () => clearTimeout(t);
  }, [query, params, pathname, router]);

  function setStatus(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "all") next.delete("status");
    else next.set("status", key);
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }

  return (
    <div className="surface flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="rail -mx-1 gap-1 px-1 sm:mx-0 sm:inline-flex sm:overflow-visible sm:px-0">
        <div className="flex shrink-0 gap-1 rounded-full bg-stone-100 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-colors sm:px-3.5 sm:py-1.5",
                status === f.key
                  ? "bg-brand-800 text-white shadow-sm"
                  : "text-stone-500 hover:text-stone-900",
              )}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums opacity-60">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative sm:w-72">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients…"
          className="h-11 w-full rounded-full border border-stone-200 bg-stone-50 pl-9 pr-3 text-base outline-none transition-colors placeholder:text-stone-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600 sm:h-9 sm:text-sm"
        />
      </div>
    </div>
  );
}
