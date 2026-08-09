import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "STIFF — Essential clothing from Tbilisi";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          <div style={{ fontSize: 200, lineHeight: 0.6, marginTop: 60 }}>
            *
          </div>
          <div
            style={{
              fontSize: 180,
              fontWeight: 900,
              letterSpacing: -6,
            }}
          >
            STIFF
          </div>
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 30,
            letterSpacing: 12,
            color: "#d4d4d8",
          }}
        >
          ESSENTIAL CLOTHING — TBILISI
        </div>
      </div>
    ),
    size,
  );
}
