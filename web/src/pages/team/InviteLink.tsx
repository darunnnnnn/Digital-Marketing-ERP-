import { useState } from "react";
import type { InviteResult } from "@/lib/invites";
import "./InviteLink.css";

/**
 * What happened to someone's invite.
 *
 * The happy path is a sentence: it went to their inbox, there is nothing to
 * copy and nothing to do. The link only appears when the mail didn't go, which
 * is the one case where somebody still has to carry it there by hand.
 */
export function InviteSent({ name, result }: { name?: string; result: InviteResult }) {
  const first = name?.split(" ")[0] ?? "They";

  if (result.sent) {
    return (
      <div className="invite-link">
        <p className="invite-link-title">Invite sent to {result.email}</p>
        <p className="invite-link-note">
          {first} will get a link to choose their own password. It works once and expires in 7
          days. Nothing else is needed from you.
        </p>
      </div>
    );
  }

  return (
    <div className="invite-link invite-link-warn">
      <p className="invite-link-title">Couldn&apos;t email the invite</p>
      <p className="invite-link-note">
        {result.why} The link below still works — send it to {first} yourself.
      </p>
      {result.link ? <LinkRow link={result.link} /> : null}
    </div>
  );
}

/** A one-time link with a copy button, for when the mail couldn't be sent. */
function LinkRow({ link }: { link: string }) {
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
  );
}
