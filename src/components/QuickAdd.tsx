"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, FileText, Plus, UserPlus } from "lucide-react";

const items = [
  { href: "/schedule/new", label: "New job", icon: CalendarPlus },
  { href: "/schedule/new?estimate=1", label: "New estimate", icon: FileText },
  { href: "/customers/new", label: "New customer", icon: UserPlus },
];

export function QuickAdd() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="btn-primary btn-tap"
      >
        <Plus
          size={16}
          className={`transition-transform ${open ? "rotate-45" : ""}`}
        />
        New
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
            className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-lg border border-line bg-card shadow-[0_12px_32px_-12px_rgba(29,42,66,0.4)]"
          >
            {items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink hover:bg-denim/5 hover:text-denim"
              >
                <Icon size={16} className="text-denim" />
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
