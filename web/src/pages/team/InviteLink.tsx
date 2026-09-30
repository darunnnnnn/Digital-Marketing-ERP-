import { useState } from "react";
import "./InviteLink.css";

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
    <div className="invite-link">
      <p className="invite-link-title">Send this link to {name?.split(" ")[0] ?? "them"}</p>
      <p className="invite-link-note">
        It works once and expires in 7 days. They&apos;ll choose their own password.
      </p>
      <div className="invite-link-row">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Invite link"
          className="invite-link-input"
        />
        <button type="button" onClick={copy} className="invite-link-copy">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
