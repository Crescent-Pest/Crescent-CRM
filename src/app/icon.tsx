import { ImageResponse } from "next/og";
import { CrescentGlyph } from "@/components/CrescentGlyph";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<CrescentGlyph size={size.width} />, { ...size });
}
