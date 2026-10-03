import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { AppShell } from "@/components/AppShell";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useAuth, useViewer } from "@/lib/auth";
import { canManageClients, canManagePayouts, canManageTeam } from "@/lib/permissions";
import { workPortals } from "@/lib/roles";
import { LoginPage } from "@/pages/LoginPage";
import { InvitePage } from "@/pages/InvitePage";
import { ClientsPage } from "@/pages/clients/ClientsPage";
import { ClientFormPage } from "@/pages/clients/ClientFormPage";
import { ClientDetailPage } from "@/pages/clients/ClientDetailPage";
import { ContentBoardPage } from "@/pages/content/ContentBoardPage";
import { ContentNewPage } from "@/pages/content/ContentNewPage";
import { ContentDetailPage } from "@/pages/content/ContentDetailPage";
import { WorkPage } from "@/pages/content/WorkPage";
import { TeamPage } from "@/pages/team/TeamPage";
import { TeamProfilePage } from "@/pages/team/TeamProfilePage";
import { PayoutsPage } from "@/pages/payouts/PayoutsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

/**
 * Every signed-in page sits inside the shell. Sign-in is checked here, but it is
 * not the protection — row level security in Postgres decides what any request
 * can actually read or write, so a hidden route cannot leak anything.
 */
function Protected({ children }: { children: ReactNode }) {
  const { viewer, loading } = useAuth();
  const { pathname, search } = useLocation();

  // Wait for the first session check, or the app flashes the login page on
  // every refresh while the stored token is being validated.
  if (loading) {
    return (
      <div className="shell-page">
        <PageSkeleton />
      </div>
    );
  }

  if (!viewer) {
    const next = encodeURIComponent(pathname + search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <AppShell user={viewer}>{children}</AppShell>;
}

/** A page only some roles may open. Others land back on the pipeline. */
function RoleGate({ allow, children }: { allow: boolean; children: ReactNode }) {
  return allow ? <>{children}</> : <Navigate to="/content" replace />;
}

/** The signed-in route tree. Rendered only once there is a viewer. */
function AppRoutes() {
  const viewer = useViewer();
  const clients = canManageClients(viewer);
  // Someone who writes, shoots and edits works from one page per role.
  const portals = workPortals(viewer);

  return (
    <Routes>
      {/* Everyone starts at the pipeline; creative roles see only their own queue. */}
      <Route index element={<Navigate to="/content" replace />} />

      <Route
        path="clients"
        element={
          <RoleGate allow={clients}>
            <ClientsPage />
          </RoleGate>
        }
      />
      <Route
        path="clients/new"
        element={
          <RoleGate allow={clients}>
            <ClientFormPage />
          </RoleGate>
        }
      />
      <Route
        path="clients/:id"
        element={
          <RoleGate allow={clients}>
            <ClientDetailPage />
          </RoleGate>
        }
      />
      <Route
        path="clients/:id/edit"
        element={
          <RoleGate allow={clients}>
            <ClientFormPage />
          </RoleGate>
        }
      />

      <Route
        path="content"
        element={
          portals.length ? <Navigate to={`/work/${portals[0].slug}`} replace /> : <ContentBoardPage />
        }
      />
      <Route path="work/:craft" element={<WorkPage />} />
      <Route path="content/new" element={<ContentNewPage />} />
      <Route path="content/:id" element={<ContentDetailPage />} />

      <Route
        path="team"
        element={
          <RoleGate allow={canManageTeam(viewer)}>
            <TeamPage />
          </RoleGate>
        }
      />
      {/* Anyone may open a profile page; it shows only what their role may read. */}
      <Route path="team/:id" element={<TeamProfilePage />} />

      <Route
        path="payouts"
        element={
          <RoleGate allow={canManagePayouts(viewer)}>
            <PayoutsPage />
          </RoleGate>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route
        path="/*"
        element={
          <Protected>
            <AppRoutes />
          </Protected>
        }
      />
    </Routes>
  );
}
