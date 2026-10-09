import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canSeeDashboard } from "@/lib/permissions";

/**
 * Where "/" lands you, which depends on what you do here. Anyone with a
 * personal dashboard starts there — their own work and their own pay for the
 * month. The CEO has no personal queue to show, so they go straight to the
 * board.
 */
export default async function Home() {
  const user = await requireUser();
  redirect(canSeeDashboard(user) ? "/dashboard" : "/content");
}
