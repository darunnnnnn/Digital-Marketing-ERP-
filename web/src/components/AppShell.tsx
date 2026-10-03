import type { ReactElement, ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "@/lib/auth";
import { deskCounts } from "@/lib/my-work";
import { rolesLabel, workPortals } from "@/lib/roles";
import { useAsync } from "@/lib/use-async";
import { cn, initials } from "@/lib/utils";
import {
  IconBell,
  IconCamera,
  IconChart,
  IconFilm,
  IconGrid,
  IconLogout,
  IconPencil,
  IconScissors,
  IconSend,
  IconSettings,
  IconSpark,
  IconUsers,
  IconWallet,
} from "./icons";
import "./AppShell.css";

type NavItem = {
  to: string;
  label: string;
  title: string;
  icon: (p: { className?: string }) => ReactElement;
  soon?: boolean;
  /** Who sees it. Omitted means everyone. */
  roles?: string[];
  /** Shown under the icon, for links that are someone's whole job. */
  caption?: string;
  /** Videos waiting on them there. */
  count?: number;
};

/** One sidebar link per desk, for someone who writes, shoots and edits. */
const CRAFT_ICONS: Record<string, NavItem["icon"]> = {
  script: IconPencil,
  shoot: IconCamera,
  edit: IconScissors,
  post: IconSend,
};

const MANAGERS = ["ceo", "manager"];

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", title: "Dashboard", icon: IconGrid, soon: true, roles: MANAGERS },
  { to: "/clients", label: "Clients", title: "Client Management", icon: IconUsers, roles: MANAGERS },
  { to: "/content", label: "Content", title: "Content Pipeline", icon: IconFilm },
  { to: "/team", label: "Team", title: "Team", icon: IconSpark, roles: ["ceo"] },
  { to: "/reports", label: "Reports", title: "Reports", icon: IconChart, soon: true, roles: MANAGERS },
  { to: "/payouts", label: "Payouts", title: "Payouts", icon: IconWallet, roles: ["ceo"] },
];

export function AppShell({
  user,
  children,
}: {
  user: { id: string; name: string; role: string; roles?: string[] | null; agencyId: string };
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const portals = workPortals(user);

  // Refetched on every navigation, so finishing a task updates the badges as
  // soon as they go back to their queue.
  const counts = useAsync(
    () => (portals.length ? deskCounts(user) : Promise.resolve({} as Record<string, number>)),
    [user.id, portals.length, pathname],
  );

  const nav = NAV.filter((n) => !n.roles || n.roles.includes(user.role)).flatMap((n) =>
    // Someone with several roles gets a desk per role in place of the one queue.
    n.to === "/content" && portals.length
      ? portals.map((c) => ({
          to: `/work/${c.slug}`,
          label: c.label,
          title: `${c.label} — your work`,
          icon: CRAFT_ICONS[c.slug] ?? IconFilm,
          caption: c.label,
          count: counts.data?.[c.slug],
        }))
      : [n],
  );
  const section = nav.find((n) => !n.soon && pathname.startsWith(n.to));
  const roleLabel = rolesLabel(user);

  return (
    <div className="shell">
      {/* Icon rail */}
      <aside className="rail">
        <Link to="/content" title="Agency OS" className="rail-mark">
          A
        </Link>

        <nav className="rail-nav">
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;

            if (item.soon) {
              return (
                <span key={item.to} title={`${item.label} — coming soon`} className="rail-link rail-soon">
                  <Icon />
                </span>
              );
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.count ? `${item.label} — ${item.count} waiting` : item.label}
                className={cn(
                  "rail-link",
                  item.caption && "rail-link-captioned",
                  active && "rail-link-active",
                )}
              >
                <Icon />
                {item.caption && <span className="rail-caption">{item.caption}</span>}
                {item.count ? <span className="rail-count">{item.count}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="rail-foot">
          <button type="button" onClick={signOut} title="Sign out" className="rail-signout">
            <IconLogout />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="shell-main">
        {/* Top bar */}
        <header className="topbar">
          <Link to="/content" className="topbar-mark">
            A
          </Link>
          <p className="topbar-title">{section?.title ?? "Agency OS"}</p>

          <div className="topbar-right">
            <button type="button" title="Settings — coming soon" className="topbar-icon">
              <IconSettings />
            </button>
            <button type="button" title="Notifications — coming soon" className="topbar-icon">
              <IconBell />
            </button>
            <span className="topbar-divider" />
            <div className="topbar-who">
              <p className="topbar-name">{user.name}</p>
              <p className="topbar-role">{roleLabel}</p>
            </div>
            <span title={`${user.name} · ${roleLabel}`} className="avatar">
              {initials(user.name)}
            </span>

            {/* Always visible, including on phones where the left rail is hidden. */}
            <button type="button" onClick={signOut} className="topbar-signout">
              <IconLogout />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        <main className="shell-page">{children}</main>
      </div>
    </div>
  );
}
