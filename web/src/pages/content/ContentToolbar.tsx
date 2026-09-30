import { useSearchParams } from "react-router";
import { IconSearch } from "@/components/icons";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { ClientOption, MemberOption } from "./types";
import "./ContentToolbar.css";

export function ContentToolbar({
  clients,
  members,
  overdueCount,
}: {
  clients: Pick<ClientOption, "id" | "name">[];
  members: MemberOption[];
  overdueCount: number;
}) {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "list" ? "list" : "board";
  const overdue = params.get("overdue") === "1";

  function push(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params);
    mutate(next);
    setParams(next, { replace: true });
  }

  function set(key: string, value: string) {
    push((n) => (value ? n.set(key, value) : n.delete(key)));
  }

  return (
    <Card className="bar">
      <div className="tabs">
        {(["board", "list"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => push((n) => (v === "board" ? n.delete("view") : n.set("view", v)))}
            className={cn("tab", "tab-caps", view === v && "tab-active")}
          >
            {v}
          </button>
        ))}
      </div>

      <select
        className="bar-select"
        aria-label="Filter by client"
        value={params.get("client") ?? ""}
        onChange={(e) => set("client", e.target.value)}
      >
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        className="bar-select"
        aria-label="Filter by person"
        value={params.get("owner") ?? ""}
        onChange={(e) => set("owner", e.target.value)}
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
        className={cn("bar-toggle", overdue && "bar-toggle-on")}
      >
        Overdue
        <span className="bar-toggle-count tabular">{overdueCount}</span>
      </button>

      <div className="search bar-search">
        <IconSearch />
        <input
          value={params.get("q") ?? ""}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search content…"
          aria-label="Search content"
        />
      </div>
    </Card>
  );
}
