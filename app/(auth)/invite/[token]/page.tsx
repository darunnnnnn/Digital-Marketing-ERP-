import Link from "next/link";
import { InviteForm } from "@/components/auth/invite-form";
import { ROLE_LABELS, type Role } from "@/lib/pipeline";
import { memberForInvite } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const member = await memberForInvite(token);

  if (!member) {
    return (
      <div className="surface px-8 py-9 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Link expired</h1>
        <p className="mt-2 text-sm text-stone-500">
          This invite has expired or has already been used. Ask your agency owner for a new one.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-700">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="surface px-8 py-9">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
        {member.agency.name}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
        Welcome, {member.name.split(" ")[0]}
      </h1>
      <p className="mt-1.5 text-sm text-stone-500">
        You&apos;ve been added as{" "}
        <span className="font-medium text-stone-700">
          {ROLE_LABELS[member.role as Role] ?? member.role}
        </span>
        . Set a password to sign in as {member.email}.
      </p>
      <div className="mt-7">
        <InviteForm token={token} />
      </div>
    </div>
  );
}
