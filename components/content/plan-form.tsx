"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createContent, type ContentFormState } from "@/app/(app)/content/actions";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FORMATS } from "@/lib/pipeline";
import { STEPS, defaultCycleStart, scheduleFrom, type DeadlineField } from "@/lib/schedule";
import { cn, dateInputValue, parseDateInput } from "@/lib/utils";
import type { ClientOption, MemberOption } from "./types";

function datesFromWeek(week: string): Record<DeadlineField, string> {
  const start = parseDateInput(week);
  const schedule = start ? scheduleFrom(start) : null;
  return STEPS.reduce(
    (acc, step) => ({
      ...acc,
      [step.field]: schedule ? dateInputValue(schedule[step.field]) : "",
    }),
    {} as Record<DeadlineField, string>,
  );
}

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Planning…" : count > 1 ? `Plan ${count} videos` : "Plan video"}
    </Button>
  );
}

export function PlanForm({
  clients,
  members,
  defaultClientId,
  onCancel,
}: {
  clients: ClientOption[];
  members: MemberOption[];
  defaultClientId?: string;
  /** In a dialog, closes it. On the full page, omitted: Cancel links back. */
  onCancel?: () => void;
}) {
  const byRole = (role: string) => members.filter((m) => m.role === role);
  const writers = byRole("scriptwriter");
  const [state, formAction] = useActionState<ContentFormState, FormData>(createContent, {});
  const prev = state.values ?? {};
  const err = state.errors ?? {};

  const [clientId, setClientId] = useState(
    prev.clientId ?? defaultClientId ?? clients[0]?.id ?? "",
  );
  const [ideas, setIdeas] = useState(prev.ideas ?? "");
  const [mode, setMode] = useState<"ideas" | "count">(
    prev.mode === "count" ? "count" : "ideas",
  );
  const [count, setCount] = useState(prev.count ?? "5");
  // "script": just the writer's deadline, everything later set at each gate.
  // "full": the whole four-week cycle, optionally assigned up front.
  const [planMode, setPlanMode] = useState<"script" | "full">(
    prev.planMode === "full" ? "full" : "script",
  );
  const [weekStart, setWeekStart] = useState(prev.weekStart ?? defaultCycleStart());
  // After a failed submit, keep what was typed; otherwise derive from the start week.
  const [dates, setDates] = useState<Record<DeadlineField, string>>(() =>
    prev.scriptDue !== undefined
      ? STEPS.reduce(
          (acc, step) => ({ ...acc, [step.field]: prev[step.field] ?? "" }),
          {} as Record<DeadlineField, string>,
        )
      : datesFromWeek(prev.weekStart ?? defaultCycleStart()),
  );

  /** Picking a start week fills in all six deadlines; each can then be changed. */
  function applyWeek(value: string) {
    setWeekStart(value);
    if (parseDateInput(value)) setDates(datesFromWeek(value));
  }

  // A step can't be due before the one it depends on.
  const outOfOrder = STEPS.findIndex(
    (step, i) =>
      i > 0 &&
      dates[step.field] &&
      dates[STEPS[i - 1].field] &&
      dates[step.field] < dates[STEPS[i - 1].field],
  );

  const selected = clients.find((c) => c.id === clientId);
  const lines =
    mode === "count" ? Number(count) || 0 : ideas.split("\n").filter((l) => l.trim()).length;
  const remaining = selected ? Math.max(0, selected.monthlyTarget - selected.planned) : 0;

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client" error={err.clientId}>
          <Select
            name="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            {clients.length === 0 && <option value="">No clients yet</option>}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        {planMode === "full" ? (
          <Field label="Cycle starts" hint="the Monday script work begins">
            <Input
              type="date"
              name="weekStart"
              value={weekStart}
              onChange={(e) => applyWeek(e.target.value)}
            />
          </Field>
        ) : (
          <Field label="Script ready by" hint="the writer's deadline" error={err.scriptDue}>
            <Input
              type="date"
              name="scriptDue"
              value={dates.scriptDue}
              onChange={(e) => setDates({ ...dates, scriptDue: e.target.value })}
            />
          </Field>
        )}
      </div>

      <input type="hidden" name="planMode" value={planMode} />
      <div className="rounded-2xl bg-brand-50/70 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-brand-900">Deadlines</p>
          <div className="inline-flex gap-1 rounded-full bg-white p-1">
            {(
              [
                ["script", "Script only"],
                ["full", "Whole cycle"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPlanMode(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  planMode === key
                    ? "bg-brand-800 text-white"
                    : "text-stone-600 hover:text-stone-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {planMode === "script" ? (
          <p className="text-xs leading-relaxed text-brand-800">
            Only the writer gets a deadline now. You&apos;ll set the shoot, edit and posting
            dates later, each time you approve the work and hand it on. Your own script review
            is set for the day after the script is due.
          </p>
        ) : (
          <>
            <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li
                  key={step.field}
                  className={cn(
                    "rounded-xl bg-white px-3 py-2.5 ring-1",
                    i === outOfOrder ? "ring-red-300" : "ring-transparent",
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                    Week {step.week} · {step.who}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-stone-800">{step.label}</p>
                  <input
                    type="date"
                    name={step.field}
                    value={dates[step.field]}
                    onChange={(e) => setDates({ ...dates, [step.field]: e.target.value })}
                    className="mt-1.5 h-10 w-full rounded-lg border border-stone-200 bg-stone-50 px-2 text-base text-stone-800 outline-none focus:border-brand-500 focus:bg-white sm:h-auto sm:py-1 sm:text-xs"
                  />
                </li>
              ))}
            </ol>
            {(outOfOrder > 0 || err.schedule) && (
              <p className="mt-2.5 text-xs text-red-600">
                {err.schedule ??
                  `"${STEPS[outOfOrder].label}" is due before "${STEPS[outOfOrder - 1].label}".`}
              </p>
            )}

            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-brand-700">
              Assign now (optional)
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["cameramanId", "cameraman", "Cameraman"],
                  ["editorId", "editor", "Editor"],
                  ["publisherId", "publisher", "Posting"],
                ] as const
              ).map(([field, role, label]) => (
                <Field key={field} label={label} error={err[field]}>
                  <Select name={field} defaultValue={prev[field] ?? ""}>
                    <option value="">Decide at the gate</option>
                    {byRole(role).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && selected.monthlyTarget > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3.5 py-2.5 text-xs">
          <span className="font-medium">{selected.name}</span>
          <span className="text-stone-500">
            has {selected.planned} of {selected.monthlyTarget} planned this month
          </span>
          {remaining > 0 && (
            <span className="ml-auto rounded-md bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
              {remaining} to plan
            </span>
          )}
        </div>
      )}

      <input type="hidden" name="mode" value={mode} />
      <div className="space-y-3">
        <div className="inline-flex gap-1 rounded-full bg-stone-100 p-1">
          {(
            [
              ["ideas", "I have the ideas"],
              ["count", "Writer proposes them"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                mode === key
                  ? "bg-brand-800 text-white"
                  : "text-stone-500 hover:text-stone-900",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "ideas" ? (
          <Field
            label="Ideas"
            hint="one per line — each becomes its own video"
            error={err.ideas}
          >
            <Textarea
              name="ideas"
              rows={6}
              value={ideas}
              onChange={(e) => setIdeas(e.target.value)}
              placeholder={
                "Signature dish reel\nBehind the scenes\nCustomer reaction\nChef interview"
              }
              autoFocus
            />
          </Field>
        ) : (
          <Field
            label="How many scripts?"
            hint="the writer names and writes each one"
            error={err.count}
          >
            <Input
              type="number"
              name="count"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              autoFocus
            />
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Format">
          <Select name="format" defaultValue={prev.format ?? "reel"}>
            {FORMATS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Priority">
          <Select name="priority" defaultValue={prev.priority ?? "normal"}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </Select>
        </Field>

        <Field
          label="Scriptwriter"
          hint={mode === "count" ? "required" : "optional"}
          error={err.scriptwriterId}
        >
          <Select name="scriptwriterId" defaultValue={prev.scriptwriterId ?? ""}>
            <option value="">Leave in Planned</option>
            {writers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <p className="text-xs leading-relaxed text-stone-400">
        Assigning a scriptwriter now sends these straight to the Scripting column. Otherwise
        they wait in Planned.
      </p>

      <div className="flex items-center justify-end gap-2.5 border-t border-stone-200 pt-4">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Link href="/content" className={buttonClass("ghost")}>
            Cancel
          </Link>
        )}
        <SubmitButton count={lines} />
      </div>
    </form>
  );
}
