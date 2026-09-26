import { requireUser } from "./auth";

/** The signed-in person's agency. Every query is scoped through this. */
export async function getCurrentAgency() {
  const user = await requireUser();
  return user.agency;
}
