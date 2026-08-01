import { Phone } from "lucide-react";

/**
 * tel: URI for a US number. Bare 10 digits get +1; 11 digits starting with 1 get
 * a plus; anything else is passed through as digits so extensions/international
 * numbers still dial rather than silently breaking the link.
 */
export function telHref(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return `tel:${digits}`;
}

export function PhoneLink({
  phone,
  icon = false,
  iconOnly = false,
  iconSize = 14,
  className = "inline-flex items-center gap-1.5 text-denim hover:underline",
}: {
  phone: string | null | undefined;
  icon?: boolean;
  /** show just the icon (number stays available to screen readers) */
  iconOnly?: boolean;
  iconSize?: number;
  className?: string;
}) {
  const href = telHref(phone);
  if (!href) return null;

  return (
    <a
      href={href}
      className={className}
      aria-label={iconOnly ? `Call ${phone}` : undefined}
    >
      {(icon || iconOnly) && (
        <Phone size={iconSize} className="shrink-0 text-gold-deep" />
      )}
      {!iconOnly && <span>{phone}</span>}
    </a>
  );
}
