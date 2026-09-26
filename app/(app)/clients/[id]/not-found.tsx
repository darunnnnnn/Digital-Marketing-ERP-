import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      title="Client not found"
      description="This client may have been deleted, or the link is out of date."
      action={<LinkButton href="/clients">Back to clients</LinkButton>}
    />
  );
}
