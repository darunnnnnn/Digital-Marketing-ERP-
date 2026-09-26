import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { DemoLogins } from "./demo-logins";
import { getUser, safeNext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getUser()) redirect(safeNext(next));

  return (
    <>
      <div className="surface px-8 py-9">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Welcome back</h1>
        <p className="mt-1.5 text-sm text-stone-500">Sign in to your agency workspace.</p>
        <div className="mt-7">
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-xs text-stone-400">
          No account? Ask your agency owner for an invite link.
        </p>
      </div>
      <DemoLogins />
    </>
  );
}
