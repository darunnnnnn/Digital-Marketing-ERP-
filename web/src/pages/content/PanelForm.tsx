import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { saveContentPanel } from "@/lib/queries";
import "./PanelForm.css";

/**
 * One panel of the video page — brief, script, shoot, edit, posting, schedule.
 *
 * The fields stay uncontrolled and are read from the form on save, exactly as
 * they were when the server handled this. It keeps each panel's markup to plain
 * inputs with names, and typing in a long script never re-renders the page.
 */
export function PanelForm({
  id,
  panel,
  editable = true,
  onSaved,
  children,
}: {
  id: string;
  panel: string;
  /** Read-only for people who can see this panel but not change it. */
  editable?: boolean;
  onSaved?: () => void;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    const message = await saveContentPanel(id, panel, (key) =>
      String(data.get(key) ?? "").trim(),
    );
    setBusy(false);
    setError(message);
    if (!message) {
      toast.say("Saved.");
      onSaved?.();
    }
  }

  return (
    <form onSubmit={save} className="panel">
      <fieldset disabled={!editable} className="panel-fields">
        {children}
      </fieldset>
      <div className="panel-foot">
        {error && <span className="panel-error">{error}</span>}
        {editable && (
          <Button type="submit" variant="secondary" size="sm" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
    </form>
  );
}
