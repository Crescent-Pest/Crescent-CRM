import { ImageResponse } from "next/og";
import { CrescentGlyph } from "@/components/CrescentGlyph";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<CrescentGlyph size={size.width} />, { ...size });
}
