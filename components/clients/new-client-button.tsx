import { IconPlus } from "@/components/icons";
import { LinkButton } from "@/components/ui/button";

/**
 * A plain link to /clients/new, not a modal — a full page for a form this
 * size renders the same way every time, with none of an overlay's edge cases
 * (scroll position, backdrop coverage, viewport height) to get wrong.
 */
export function NewClientButton({ label = "New client" }: { label?: string }) {
  return (
    <LinkButton href="/clients/new">
      <IconPlus className="h-4 w-4" />
      {label}
    </LinkButton>
  );
}
