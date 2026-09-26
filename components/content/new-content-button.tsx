import { IconPlus } from "@/components/icons";
import { LinkButton } from "@/components/ui/button";

/**
 * A link to the Plan content page. It used to open a popup, but the form
 * (ideas, deadlines, assignments) is too long for one — it ended up cramped
 * and scrolling inside a small box. A full page has room for all of it.
 */
export function NewContentButton({
  defaultClientId,
  label = "Plan content",
  variant = "primary",
  className,
}: {
  defaultClientId?: string;
  label?: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const href = defaultClientId
    ? `/content/new?client=${encodeURIComponent(defaultClientId)}`
    : "/content/new";

  return (
    <LinkButton href={href} variant={variant} className={className}>
      <IconPlus className="h-4 w-4" />
      {label}
    </LinkButton>
  );
}
