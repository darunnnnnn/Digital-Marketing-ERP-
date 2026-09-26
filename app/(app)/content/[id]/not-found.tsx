import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      title="Content not found"
      description="This video may have been deleted, or the link is out of date."
      action={<LinkButton href="/content">Back to the pipeline</LinkButton>}
    />
  );
}
