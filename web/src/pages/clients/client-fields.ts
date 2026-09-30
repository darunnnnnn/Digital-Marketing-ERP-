// Validation for the client form. Kept away from the component so the rules can
// be read — and tested — on their own.

import { ACCENT_KEYS } from "@/lib/theme";
import type { Client } from "@/lib/types";

export type ClientValues = {
  name: string;
  industry: string;
  status: string;
  accent: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  monthlyTarget: string;
  monthlyPostTarget: string;
  retainer: string;
  services: string;
  notes: string;
};

export const STATUSES = ["active", "paused", "archived"];

export const EMPTY_CLIENT: ClientValues = {
  name: "",
  industry: "",
  status: "active",
  accent: "default",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  monthlyTarget: "12",
  monthlyPostTarget: "0",
  retainer: "0",
  services: "",
  notes: "",
};

/** Turns a saved client into form values. */
export function clientToValues(c: Client): ClientValues {
  return {
    name: c.name,
    industry: c.industry ?? "",
    status: c.status,
    accent: "default",
    contactName: c.contactName ?? "",
    contactEmail: c.contactEmail ?? "",
    contactPhone: c.contactPhone ?? "",
    monthlyTarget: String(c.monthlyTarget),
    monthlyPostTarget: String(c.monthlyPostTarget),
    retainer: String(c.retainer),
    services: c.services,
    notes: c.notes ?? "",
  };
}

export function validateClient(values: ClientValues) {
  const v = { ...values };
  for (const key of Object.keys(v) as (keyof ClientValues)[]) v[key] = v[key].trim();

  const errors: Record<string, string> = {};

  if (!v.name) errors.name = "Client name is required.";
  else if (v.name.length > 80) errors.name = "Keep the name under 80 characters.";

  if (v.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contactEmail)) {
    errors.contactEmail = "That doesn't look like a valid email.";
  }

  const target = Number(v.monthlyTarget || 0);
  if (!Number.isInteger(target) || target < 0 || target > 999) {
    errors.monthlyTarget = "Enter a whole number between 0 and 999.";
  }

  const postTarget = Number(v.monthlyPostTarget || 0);
  if (!Number.isInteger(postTarget) || postTarget < 0 || postTarget > 999) {
    errors.monthlyPostTarget = "Enter a whole number between 0 and 999.";
  }

  const retainer = Number(v.retainer || 0);
  if (!Number.isFinite(retainer) || retainer < 0) {
    errors.retainer = "Enter a positive amount.";
  }

  if (!STATUSES.includes(v.status)) v.status = "active";
  if (!ACCENT_KEYS.includes(v.accent as never)) v.accent = "default";

  return {
    errors,
    data: {
      name: v.name,
      industry: v.industry || null,
      status: v.status,
      accent: v.accent,
      contactName: v.contactName || null,
      contactEmail: v.contactEmail || null,
      contactPhone: v.contactPhone || null,
      monthlyTarget: target,
      monthlyPostTarget: postTarget,
      retainer: Math.round(retainer),
      services: v.services,
      notes: v.notes || null,
    },
  };
}
