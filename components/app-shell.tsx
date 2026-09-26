"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { ROLE_LABELS, type Role } from "@/lib/pipeline";
import { cn, initials } from "@/lib/utils";
import {
  IconBell,
  IconChart,
  IconFilm,
  IconGrid,
  IconLogout,
  IconSettings,
  IconSpark,
  IconUsers,
  IconWallet,
} from "./icons";

type NavItem = {
  href: string;
  label: string;
  title: string;
  icon: (p: { className?: string }) => React.ReactElement;
  soon?: boolean;
  /** Who sees it. Omitted means everyone. */
  roles?: string[];
};

const MANAGERS = ["ceo", "manager"];

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    title: "Dashboard",
    icon: IconGrid,
    soon: true,
    roles: MANAGERS,
  },
  {
    href: "/clients",
    label: "Clients",
    title: "Client Management",
    icon: IconUsers,
    roles: MANAGERS,
  },
  { href: "/content", label: "Content", title: "Content Pipeline", icon: IconFilm },
  { href: "/team", label: "Team", title: "Team", icon: IconSpark, roles: ["ceo"] },
  {
    href: "/reports",
    label: "Reports",
    title: "Reports",
    icon: IconChart,
    soon: true,
    roles: MANAGERS,
  },
  {
    href: "/payouts",
    label: "Payouts",
    title: "Payouts",
    icon: IconWallet,
    roles: ["ceo"],
  },
];

export function AppShell({
  user,
  children,
}: {
  user: { name: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = NAV.filter((n) => !n.roles || n.roles.includes(user.role));
  const section = nav.find((n) => !n.soon && pathname.startsWith(n.href));
  const roleLabel = ROLE_LABELS[user.role as Role] ?? user.role;

  return (
    <div className="flex min-h-screen w-full">
      {/* Icon rail */}
      <aside className="sticky top-0 hidden h-screen w-[88px] shrink-0 flex-col items-center border-r border-white/70 bg-white/60 py-5 backdrop-blur-xl lg:flex">
        <Link
          href="/content"
          title="Agency OS"
          className="grid h-12 w-12 place-items-center rounded-2xl bg-white font-serif text-2xl text-brand-800 shadow-sm ring-1 ring-stone-200"
        >
          A
        </Link>

        <nav className="mt-8 flex flex-col items-center gap-2">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            if (item.soon) {
              return (
                <span
                  key={item.href}
                  title={`${item.label} — coming soon`}
                  className="grid h-12 w-12 cursor-not-allowed place-items-center rounded-2xl text-stone-300"
                >
                  <Icon className="h-5 w-5" />
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-2xl transition-colors",
                  active
                    ? "bg-brand-800 text-white shadow-lg shadow-brand-900/25"
                    : "text-stone-500 hover:bg-white hover:text-brand-800",
                )}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-3 border-t border-stone-200/70 pt-5">
          <form action={signOut} className="w-full">
            <button
              type="submit"
              title="Sign out"
              className="flex w-full flex-col items-center gap-1 rounded-2xl py-2 text-stone-500 transition-colors hover:bg-white hover:text-red-600"
            >
              <IconLogout className="h-4 w-4" />
              <span className="text-[10px] font-medium">Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-white/70 bg-white/70 px-5 backdrop-blur-xl lg:px-10">
          <Link
            href="/clients"
            className="grid h-10 w-10 place-items-center rounded-xl bg-white font-serif text-xl text-brand-800 ring-1 ring-stone-200 lg:hidden"
          >
            A
          </Link>
          <p className="text-lg font-medium text-stone-900">{section?.title ?? "Agency OS"}</p>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              title="Settings — coming soon"
              className="grid h-10 w-10 place-items-center rounded-full text-stone-500 transition-colors hover:bg-white hover:text-brand-800"
            >
              <IconSettings className="h-5 w-5" />
            </button>
            <button
              type="button"
              title="Notifications — coming soon"
              className="relative grid h-10 w-10 place-items-center rounded-full text-stone-500 transition-colors hover:bg-white hover:text-brand-800"
            >
              <IconBell className="h-5 w-5" />
            </button>
            <span className="mx-2 h-8 w-px bg-stone-200" />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-stone-900">{user.name}</p>
              <p className="text-xs text-stone-500">{roleLabel}</p>
            </div>
            <span
              title={`${user.name} · ${roleLabel}`}
              className="grid h-11 w-11 place-items-center rounded-full bg-brand-800 text-sm font-medium text-white shadow-md shadow-brand-900/25"
            >
              {initials(user.name)}
            </span>

            {/* Always visible, including on phones where the left rail is hidden. */}
            <form action={signOut}>
              <button
                type="submit"
                className="ml-1 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-stone-600 ring-1 ring-stone-200 transition-colors hover:text-red-600 hover:ring-red-200"
              >
                <IconLogout className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
