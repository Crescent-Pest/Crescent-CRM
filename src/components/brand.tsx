/** Gold crescent moon mark used on login + sidebar */
export function CrescentMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M30.5 27.9A13.4 13.4 0 0 1 12.6 10a14 14 0 1 0 17.9 17.9Z"
        fill="var(--gold)"
      />
      <circle cx="27" cy="12" r="2.2" fill="var(--gold)" opacity="0.7" />
    </svg>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <div className="leading-none">
      <div
        className={`font-display text-xl font-bold uppercase tracking-[0.14em] ${
          light ? "text-white" : "text-denim-ink"
        }`}
      >
        Crescent
      </div>
      <div className="font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-gold">
        Pest Control · SC
      </div>
    </div>
  );
}
