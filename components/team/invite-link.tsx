"use client";

import { useState } from "react";

/** Shows a one-time invite link with a copy button. */
export function InviteLink({ name, link }: { name?: string; link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is still selectable below */
    }
  }

  return (
    <div className="rounded-2xl bg-brand-50/80 p-4">
      <p className="text-sm font-medium text-brand-900">
        Send this link to {name?.split(" ")[0] ?? "them"}
      </p>
      <p className="mt-0.5 text-xs text-brand-700">
        It works once and expires in 7 days. They&apos;ll choose their own password.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl border border-brand-200 bg-white px-3 py-2.5 font-mono text-base text-stone-700 outline-none sm:py-2 sm:text-xs"
        />
        <button
          type="button"
          onClick={copy}
          className="h-10 shrink-0 rounded-full bg-brand-800 px-4 text-xs font-medium text-white transition-colors hover:bg-brand-900 sm:h-auto"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
