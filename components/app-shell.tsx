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
  /** Even shorter, for the phone tab bar where a label gets about 70px. */
  short?: string;
  icon: (p: { className?: string }) => React.ReactElement;
  soon?: boolean;
  /** Who sees it. Omitted means everyone. */
  roles?: string[];
};

const MANAGERS = ["ceo", "manager"];

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "My dashboard",
    title: "My dashboard",
    short: "Home",
    icon: IconGrid,
    // Everyone but the CEO, who is not paid through the pipeline and already
    // has the agency-wide views.
    roles: ["manager", "scriptwriter", "cameraman", "editor", "publisher"],
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
    short: "Pay",
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

  // The phone tab bar carries only places you can actually go — a greyed-out
  // "coming soon" tab wastes the scarcest space on the screen. With a single
  // destination there is nothing to switch between, so the bar is dropped.
  const tabs = nav.filter((n) => !n.soon);
  const showTabs = tabs.length > 1;

  // A scriptwriter has no /clients, so the logo cannot hardcode it.
  const home = tabs[0]?.href ?? "/content";

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-screen w-full">
      {/* Icon rail — desktop only; phones get the bottom tab bar instead. */}
      <aside className="sticky top-0 hidden h-screen w-[88px] shrink-0 flex-col items-center border-r border-white/70 bg-white/60 py-5 backdrop-blur-xl lg:flex">
        <Link
          href={home}
          title="Agency OS"
          className="grid h-12 w-12 place-items-center rounded-2xl bg-white font-serif text-2xl text-brand-800 shadow-sm ring-1 ring-stone-200"
        >
          A
        </Link>

        <nav className="mt-8 flex flex-col items-center gap-2">
          {nav.map((item) => {
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
                  isActive(item.href)
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
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/70 bg-white/80 px-4 backdrop-blur-xl sm:px-5 lg:h-20 lg:gap-4 lg:px-10">
          <Link
            href={home}
            aria-label="Agency OS"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white font-serif text-xl text-brand-800 ring-1 ring-stone-200 lg:hidden"
          >
            A
          </Link>
          <p className="min-w-0 truncate text-base font-medium text-stone-900 lg:text-lg">
            {section?.title ?? "Agency OS"}
          </p>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {/* Both are placeholders; on a phone the room is better spent on
                controls that actually do something. */}
            <button
              type="button"
              title="Settings — coming soon"
              className="hidden h-10 w-10 place-items-center rounded-full text-stone-500 transition-colors hover:bg-white hover:text-brand-800 sm:grid"
            >
              <IconSettings className="h-5 w-5" />
            </button>
            <button
              type="button"
              title="Notifications — coming soon"
              className="relative hidden h-10 w-10 place-items-center rounded-full text-stone-500 transition-colors hover:bg-white hover:text-brand-800 sm:grid"
            >
              <IconBell className="h-5 w-5" />
            </button>
            <span className="mx-2 hidden h-8 w-px bg-stone-200 sm:block" />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-stone-900">{user.name}</p>
              <p className="text-xs text-stone-500">{roleLabel}</p>
            </div>
            <span
              title={`${user.name} · ${roleLabel}`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-800 text-sm font-medium text-white shadow-md shadow-brand-900/25 lg:h-11 lg:w-11"
            >
              {initials(user.name)}
            </span>

            {/* Always reachable — the desktop rail that normally holds this is
                hidden on phones. */}
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                className="ml-0.5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-3 text-sm font-medium text-stone-600 ring-1 ring-stone-200 transition-colors hover:text-red-600 hover:ring-red-200 sm:px-4"
              >
                <IconLogout className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-5 sm:py-8 lg:px-10 lg:py-10",
            // Clear the fixed tab bar so the last card is never trapped under it.
            showTabs && "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10",
          )}
        >
          {children}
        </main>
      </div>

      {/* Phone tab bar — thumb height, one tap to anywhere. */}
      {showTabs && (
        <nav
          aria-label="Main"
          className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-stone-200/80 bg-white/90 backdrop-blur-xl lg:hidden"
        >
          <ul className="flex items-stretch">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                      active ? "text-brand-800" : "text-stone-400",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-12 place-items-center rounded-full transition-colors",
                        active && "bg-brand-50",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    {item.short ?? item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
