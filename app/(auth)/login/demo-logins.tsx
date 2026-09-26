import { signInAsDemo } from "@/app/(auth)/actions";
import { db } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/pipeline";

/** Shown only while developing, so testing doesn't mean typing passwords. */
export async function DemoLogins() {
  if (process.env.NODE_ENV === "production") return null;

  const members = await db.member.findMany({
    where: { email: { endsWith: "@demo.test" }, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
  if (members.length === 0) return null;

  // One per role, in the order work flows through the agency.
  const order = ["ceo", "manager", "scriptwriter", "cameraman", "editor", "publisher"];
  const pick = order
    .map((role) => members.find((m) => m.role === role))
    .filter((m): m is (typeof members)[number] => Boolean(m));

  return (
    <div className="surface mt-5 px-6 py-5">
      <p className="text-sm font-medium text-stone-900">Quick sign-in for testing</p>
      <p className="mt-0.5 text-xs text-stone-500">
        One click, no password. Development only.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {pick.map((m) => (
          <form key={m.id} action={signInAsDemo}>
            <input type="hidden" name="email" value={m.email ?? ""} />
            <button
              type="submit"
              className="w-full rounded-2xl bg-stone-50 px-4 py-3 text-left ring-1 ring-stone-200 transition-colors hover:bg-brand-50 hover:ring-brand-300"
            >
              <span className="block text-sm font-medium text-stone-900">
                {ROLE_LABELS[m.role as Role] ?? m.role}
              </span>
              <span className="block text-xs text-stone-500">{m.name}</span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
