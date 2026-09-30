import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="That link doesn't lead anywhere in Agency OS. It may have been moved or deleted."
      action={
        <LinkButton to="/content" size="sm">
          Back to the pipeline
        </LinkButton>
      }
    />
  );
}
