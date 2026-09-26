import { addNote } from "@/app/(app)/content/actions";
import { Button } from "@/components/ui/button";
import { cn, timeAgo } from "@/lib/utils";

const KIND_STYLES: Record<string, { dot: string; label: string }> = {
  created: { dot: "bg-stone-400", label: "Planned" },
  stage: { dot: "bg-brand-500", label: "Stage" },
  revision: { dot: "bg-stone-400", label: "Revision" },
  assign: { dot: "bg-brand-500", label: "Assigned" },
  note: { dot: "bg-stone-300", label: "Note" },
  publish: { dot: "bg-brand-600", label: "Published" },
};

export function Timeline({
  id,
  events,
}: {
  id: string;
  events: {
    id: string;
    kind: string;
    message: string;
    actor: string | null;
    createdAt: Date;
  }[];
}) {
  return (
    <div className="p-5">
      <form action={addNote} className="flex gap-2">
        <input type="hidden" name="id" value={id} />
        <input
          name="message"
          required
          maxLength={280}
          placeholder="Add a note for the team…"
          className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-stone-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
        />
        <Button type="submit" variant="secondary" size="md">
          Post
        </Button>
      </form>

      {events.length === 0 ? (
        <p className="mt-5 text-sm text-stone-400">Nothing logged yet.</p>
      ) : (
        <ol className="mt-5 space-y-0">
          {events.map((event, i) => {
            const style = KIND_STYLES[event.kind] ?? KIND_STYLES.note;
            const last = i === events.length - 1;

            return (
              <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                {!last && (
                  <span className="absolute left-[5px] top-4 h-full w-px bg-stone-200" />
                )}
                <span
                  className={cn("relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", style.dot)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{event.message}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-stone-400">
                    {event.actor ? `${event.actor} · ` : ""}
                    {timeAgo(event.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
