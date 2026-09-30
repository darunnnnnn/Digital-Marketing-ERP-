import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { addNote } from "@/lib/queries";
import { cn, timeAgo, toDate } from "@/lib/utils";
import type { ContentEvent } from "@/lib/types";
import "./Timeline.css";

const KIND_TONES: Record<string, string> = {
  created: "dot-quiet",
  stage: "dot-brand",
  revision: "dot-quiet",
  assign: "dot-brand",
  note: "dot-faint",
  publish: "dot-strong",
};

export function Timeline({
  id,
  events,
  actor,
  onPosted,
}: {
  id: string;
  events: ContentEvent[];
  actor?: string;
  /** Refetches the log, since nothing reloads the page any more. */
  onPosted?: () => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    try {
      await addNote(id, message, actor);
      setMessage("");
      onPosted?.();
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : "Couldn't post that note.");
    }
    setBusy(false);
  }

  return (
    <div className="timeline">
      <form onSubmit={post} className="timeline-form">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={280}
          placeholder="Add a note for the team…"
          aria-label="Add a note for the team"
          className="timeline-input"
        />
        <Button type="submit" variant="secondary" size="md" disabled={busy}>
          Post
        </Button>
      </form>

      {events.length === 0 ? (
        <p className="timeline-empty">Nothing logged yet.</p>
      ) : (
        <ol className="timeline-list">
          {events.map((event, i) => {
            const tone = KIND_TONES[event.kind] ?? KIND_TONES.note;
            const last = i === events.length - 1;
            const at = toDate(event.createdAt);

            return (
              <li key={event.id} className="timeline-item">
                {!last && <span className="timeline-thread" />}
                <span className={cn("timeline-dot", tone)} />
                <div className="timeline-body">
                  <p className="timeline-message">{event.message}</p>
                  <p className="timeline-meta">
                    {event.actor ? `${event.actor} · ` : ""}
                    {at ? timeAgo(at) : ""}
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
