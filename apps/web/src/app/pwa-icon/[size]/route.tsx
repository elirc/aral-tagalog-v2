import { ImageResponse } from "next/og";
import { colors } from "@aral/ui";

// Android launcher icons (manifest purpose "maskable"): full-bleed and opaque
// so the OS can crop to its own shape. The "A" mark stays well inside the
// 80% safe zone. Rendered once at build time.
export const dynamic = "force-static";
export const dynamicParams = false;

const SIZES = [192, 512] as const;

export function generateStaticParams() {
  return SIZES.map((s) => ({ size: String(s) }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = SIZES.find((s) => String(s) === raw) ?? 512;
  const glyph = Math.round(size * 0.62);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.primary,
        }}
      >
        {/* same "A" mark as icon.svg / apple-icon */}
        <svg width={glyph} height={glyph} viewBox="0 0 100 100">
          <path
            d="M30 74 50 24 70 74M37 57h26"
            fill="none"
            stroke="#fff"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
