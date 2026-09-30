import type { ReactElement, ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "@/lib/auth";
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
import "./AppShell.css";

type NavItem = {
  to: string;
  label: string;
  title: string;
  icon: (p: { className?: string }) => ReactElement;
  soon?: boolean;
  /** Who sees it. Omitted means everyone. */
  roles?: string[];
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
  user: { name: string; role: string };
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const nav = NAV.filter((n) => !n.roles || n.roles.includes(user.role));
  const section = nav.find((n) => !n.soon && pathname.startsWith(n.to));
  const roleLabel = ROLE_LABELS[user.role as Role] ?? user.role;

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
                title={item.label}
                className={cn("rail-link", active && "rail-link-active")}
              >
                <Icon />
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
