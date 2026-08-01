"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  deleteCustomer,
  setCustomerStatus,
} from "@/lib/actions/customers";

const itemClass =
  "flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-ink hover:bg-denim/5 hover:text-denim";

export function CustomerMenu({
  id,
  name,
  status,
  canDelete,
}: {
  id: string;
  name: string;
  status: "active" | "inactive";
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Actions for ${name}`}
        className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-ink-soft hover:bg-denim/10 hover:text-denim"
      >
        <MoreVertical size={17} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-card shadow-[0_12px_32px_-12px_rgba(29,42,66,0.4)]"
          >
            <Link
              href={`/customers/${id}/edit`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <Pencil size={15} className="text-denim" /> Edit
            </Link>

            <form action={setCustomerStatus}>
              <input type="hidden" name="id" value={id} />
              <input
                type="hidden"
                name="status"
                value={status === "active" ? "inactive" : "active"}
              />
              <button type="submit" role="menuitem" className={itemClass}>
                {status === "active" ? (
                  <>
                    <Archive size={15} className="text-denim" /> Mark inactive
                  </>
                ) : (
                  <>
                    <ArchiveRestore size={15} className="text-denim" /> Reactivate
                  </>
                )}
              </button>
            </form>

            {canDelete && (
            <form
              action={deleteCustomer}
              onSubmit={(e) => {
                if (
                  !window.confirm(
                    `Delete ${name}? This permanently removes their addresses, plans, jobs, and notes. This can't be undone.`
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left text-sm font-medium text-danger hover:bg-danger/5"
              >
                <Trash2 size={15} /> Delete
              </button>
            </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
