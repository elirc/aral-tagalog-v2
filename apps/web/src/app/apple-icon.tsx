import { ImageResponse } from "next/og";
import { colors } from "@aral/ui";

// iOS home-screen icon. Full-bleed (iOS applies its own rounded mask) and
// opaque — Safari ignores icon.svg here and renders transparency as black.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        {/* same "A" mark as icon.svg */}
        <svg width="124" height="124" viewBox="0 0 100 100">
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
    size,
  );
}
