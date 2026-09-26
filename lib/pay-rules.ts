// The pay rules, with no database access, so both the browser (pay settings,
// approval preview) and the server can use them.

export const PAY_TYPES = [
  { key: "per_task", label: "Per task", hint: "rate × deliveries" },
  { key: "salary", label: "Salary", hint: "fixed monthly amount" },
  { key: "hybrid", label: "Hybrid", hint: "salary + rate × deliveries" },
] as const;

export type PayType = (typeof PAY_TYPES)[number]["key"];

export function payTypeLabel(key: string) {
  return PAY_TYPES.find((p) => p.key === key)?.label ?? key;
}

/** True when someone's settings can never produce any pay — they aren't on payroll. */
export function onPayroll(payType: string, rate: number, salary: number) {
  if (payType === "per_task") return rate > 0;
  if (payType === "salary") return salary > 0;
  return rate > 0 || salary > 0;
}

/** The whole pay rule. Everything else in this file just gathers inputs for it. */
export function computePay(
  payType: string,
  deliveries: number,
  rate: number,
  salary: number,
  adjustment = 0,
) {
  const taskPay = payType === "per_task" || payType === "hybrid" ? deliveries * rate : 0;
  const base = payType === "salary" || payType === "hybrid" ? salary : 0;
  return { taskPay, base, adjustment, total: taskPay + base + adjustment };
}

/** RFC 4180 CSV, with a guard against spreadsheet formula injection. */
export function toCsv(rows: (string | number)[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          // Numbers pass through untouched, so a deduction stays a real -500
          // that sums in a spreadsheet.
          if (typeof cell === "number") return String(cell);
          let v = cell;
          if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`; // Excel would run these as formulas
          return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(","),
    )
    .join("\r\n");
}
