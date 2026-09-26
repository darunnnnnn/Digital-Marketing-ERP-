"use client";

import { useState } from "react";
import { createClient } from "@/app/(app)/clients/actions";
import { IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ClientForm } from "./client-form";

export function NewClientButton({ label = "New client" }: { label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus className="h-4 w-4" />
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a client"
        subtitle="Set the monthly content target now — every report in Agency OS counts against it."
      >
        <ClientForm
          action={createClient}
          submitLabel="Create client"
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
