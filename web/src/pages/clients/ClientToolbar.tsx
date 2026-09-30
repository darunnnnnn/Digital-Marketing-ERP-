import { useSearchParams } from "react-router";
import { IconSearch } from "@/components/icons";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "archived", label: "Archived" },
];

/**
 * The filter lives in the URL, so a filtered list can be bookmarked or shared
 * and the back button behaves the way people expect.
 */
export function ClientToolbar({ counts }: { counts: Record<string, number> }) {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "all";
  const query = params.get("q") ?? "";

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && !(key === "status" && value === "all")) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <Card className="toolbar">
      <div className="tabs">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => set("status", f.key)}
            className={cn("tab", status === f.key && "tab-active")}
          >
            {f.label}
            <span className="tab-count">{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="search">
        <IconSearch />
        <input
          value={query}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search clients…"
          aria-label="Search clients"
        />
      </div>
    </Card>
  );
}
