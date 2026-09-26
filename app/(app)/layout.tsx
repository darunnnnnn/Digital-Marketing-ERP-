import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

// Everything inside (app) needs a valid session — this is the real gate;
// middleware only turns away requests with no cookie at all.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return <AppShell user={{ name: user.name, role: user.role }}>{children}</AppShell>;
}
