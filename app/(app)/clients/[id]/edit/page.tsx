import Link from "next/link";
import { notFound } from "next/navigation";
import { updateClient } from "@/app/(app)/clients/actions";
import { ClientForm } from "@/components/clients/client-form";
import { IconChevronLeft } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agency } = await requireRole(canManageClients);
  const client = await db.client.findFirst({ where: { id, agencyId: agency.id } });

  if (!client) notFound();

  const action = updateClient.bind(null, client.id);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/clients/${client.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
      >
        <IconChevronLeft className="h-4 w-4" />
        Back to {client.name}
      </Link>

      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900">Edit client</h1>
        <p className="mt-2 text-base text-stone-500">
          Changes apply to this month&apos;s targets and every report from here on.
        </p>
      </div>

      <Card className="p-6">
        <ClientForm action={action} defaults={client} submitLabel="Save changes" />
      </Card>
    </div>
  );
}
