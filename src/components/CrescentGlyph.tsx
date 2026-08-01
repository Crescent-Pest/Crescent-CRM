const INK = "#1d2a42";
const GOLD = "#f2b02e";

/**
 * App-icon artwork for the `next/og` ImageResponse routes (icon / apple-icon).
 * Satori has no CSS classes or SVG paths here, so the crescent from CrescentMark
 * is rebuilt as a gold disc with an ink disc punched out of its upper right.
 * Ratios are the CrescentMark 40-unit viewBox scaled into an inset glyph box.
 */
export function CrescentGlyph({ size }: { size: number }) {
  const glyph = size * 0.68;
  const inset = size * 0.16;
  const disc = (left: number, top: number, d: number) => ({
    position: "absolute" as const,
    left: inset + glyph * left,
    top: inset + glyph * top,
    width: glyph * d,
    height: glyph * d,
    borderRadius: "50%",
  });

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        background: INK,
        borderRadius: size * 0.22,
      }}
    >
      <div style={{ ...disc(0.15, 0.15, 0.7), background: GOLD }} />
      <div style={{ ...disc(0.2825, 0.06, 0.67), background: INK }} />
      <div style={{ ...disc(0.62, 0.245, 0.11), background: GOLD, opacity: 0.7 }} />
    </div>
  );
}
