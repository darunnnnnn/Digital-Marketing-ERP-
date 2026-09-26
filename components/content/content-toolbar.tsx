"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { IconSearch } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ClientOption, MemberOption } from "./types";

export function ContentToolbar({
  clients,
  members,
  overdueCount,
}: {
  clients: Pick<ClientOption, "id" | "name">[];
  members: MemberOption[];
  overdueCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const view = params.get("view") === "list" ? "list" : "board";
  const overdue = params.get("overdue") === "1";
  const [query, setQuery] = useState(params.get("q") ?? "");

  function push(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }

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

  const selectClass =
    "h-9 cursor-pointer rounded-full px-3.5 border border-stone-200 bg-stone-50 px-2.5 text-xs font-semibold outline-none transition-colors focus:border-brand-600 focus:ring-1 focus:ring-brand-600";

  return (
    <div className="surface p-3 flex flex-wrap items-center gap-2.5">
      <div className="inline-flex gap-1 rounded-full bg-stone-100 p-1">
        {(["board", "list"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => push((n) => (v === "board" ? n.delete("view") : n.set("view", v)))}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-colors",
              view === v
                ? "bg-brand-800 text-white shadow-sm"
                : "text-stone-500 hover:text-stone-900",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      <select
        className={selectClass}
        value={params.get("client") ?? ""}
        onChange={(e) =>
          push((n) => (e.target.value ? n.set("client", e.target.value) : n.delete("client")))
        }
      >
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={params.get("owner") ?? ""}
        onChange={(e) =>
          push((n) => (e.target.value ? n.set("owner", e.target.value) : n.delete("owner")))
        }
      >
        <option value="">Anyone</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => push((n) => (overdue ? n.delete("overdue") : n.set("overdue", "1")))}
        className={cn(
          "h-9 rounded-full border px-3.5 text-xs font-medium transition-colors",
          overdue
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-stone-200 bg-stone-50 text-stone-500 hover:text-stone-900",
        )}
      >
        Overdue
        <span className="ml-1.5 tabular-nums opacity-70">{overdueCount}</span>
      </button>

      <div className="relative ml-auto w-full sm:w-64">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search content…"
          className="h-9 w-full rounded-full border border-stone-200 bg-stone-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-stone-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
        />
      </div>
    </div>
  );
}
