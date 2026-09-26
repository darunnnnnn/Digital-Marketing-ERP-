"use client";

import { useState } from "react";
import { deleteClient } from "@/app/(app)/clients/actions";
import { IconTrash } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function DeleteClientButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <IconTrash className="h-4 w-4" />
        Delete
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Delete ${name}?`}>
        <p className="text-sm leading-relaxed text-stone-600">
          This removes the client and every content record attached to them. It cannot be
          undone.
        </p>
        <form action={deleteClient} className="mt-6 flex justify-end gap-2.5">
          <input type="hidden" name="id" value={id} />
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Keep client
          </Button>
          <Button type="submit" variant="danger">
            Yes, delete
          </Button>
        </form>
      </Modal>
    </>
  );
}
