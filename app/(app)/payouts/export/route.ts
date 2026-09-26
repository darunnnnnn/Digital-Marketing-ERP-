import { getUser } from "@/lib/auth";
import { monthPayouts, payTypeLabel, toCsv } from "@/lib/payouts";
import { canManagePayouts } from "@/lib/permissions";
import { ROLE_LABELS, type Role } from "@/lib/pipeline";
import { currentMonthKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user || !canManagePayouts(user)) {
    return new Response("Not allowed", { status: 403 });
  }

  const param = new URL(req.url).searchParams.get("month") ?? "";
  const monthKey = /^\d{4}-\d{2}$/.test(param) ? param : currentMonthKey();
  const rows = await monthPayouts(user.agencyId, monthKey);

  const csv = toCsv([
    [
      "Name",
      "Role",
      "Pay type",
      "Deliveries",
      "Rate per task",
      "Task pay",
      "Salary",
      "Adjustment",
      "Adjustment note",
      "Total",
      "Status",
      "Paid on",
    ],
    ...rows
      .filter((r) => r.onPayroll)
      .map((r) => [
        r.name,
        ROLE_LABELS[r.role as Role] ?? r.role,
        payTypeLabel(r.payType),
        r.deliveries,
        r.rate,
        r.taskPay,
        r.base,
        r.adjustment,
        r.note ?? "",
        r.total,
        r.status,
        r.paidAt ? r.paidAt.toISOString().slice(0, 10) : "",
      ]),
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payouts-${monthKey}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
