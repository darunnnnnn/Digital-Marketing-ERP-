"use client";

import { useState } from "react";
import { deleteContent } from "@/app/(app)/content/actions";
import { IconTrash } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function DeleteContentButton({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-xl text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
        aria-label="Delete this content"
      >
        <IconTrash className="h-4 w-4" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Delete this content?">
        <p className="text-sm leading-relaxed text-stone-600">
          <span className="font-medium">{title}</span> and its whole activity log will be
          removed. This cannot be undone.
        </p>
        <form action={deleteContent} className="mt-6 flex justify-end gap-2.5">
          <input type="hidden" name="id" value={id} />
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <Button type="submit" variant="danger">
            Yes, delete
          </Button>
        </form>
      </Modal>
    </>
  );
}
