import Link from "next/link";
import { createClient } from "@/app/(app)/clients/actions";
import { ClientForm } from "@/components/clients/client-form";
import { IconChevronLeft } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  await requireRole(canManageClients);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
      >
        <IconChevronLeft className="h-4 w-4" />
        Back to clients
      </Link>

      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900">Add a client</h1>
        <p className="mt-2 text-base text-stone-500">
          Set the monthly content target now — every report in Agency OS counts against it.
        </p>
      </div>

      <Card className="p-6">
        <ClientForm action={createClient} submitLabel="Create client" />
      </Card>
    </div>
  );
}
