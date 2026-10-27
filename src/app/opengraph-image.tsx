import { ImageResponse } from "next/og";

// The picture on link previews (WhatsApp, iMessage, Facebook). Anyone can
// fetch it, so it shows only the family name, motto and flag: no people.
export const alt = "The Bryan Family: Out of many, one people";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#111111" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
          }}
        >
          <svg width="240" height="120" viewBox="0 0 48 24">
            <rect width="48" height="24" fill="#009B3A" />
            <polygon points="0,0 24,12 0,24" fill="#000000" />
            <polygon points="48,0 24,12 48,24" fill="#000000" />
            <line x1="0" y1="0" x2="48" y2="24" stroke="#FED100" strokeWidth="4" />
            <line x1="48" y1="0" x2="0" y2="24" stroke="#FED100" strokeWidth="4" />
          </svg>
          <div style={{ display: "flex", fontSize: 40, color: "#FED100" }}>Out of many, one people</div>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 700, color: "#ffffff", lineHeight: 1 }}>
            The Bryan Family
          </div>
          <div style={{ display: "flex", fontSize: 36, color: "#d4d4d4" }}>Our private family directory</div>
        </div>
        <div style={{ display: "flex", height: 24 }}>
          <div style={{ flex: 1, background: "#009B3A" }} />
          <div style={{ flex: 1, background: "#FED100" }} />
          <div style={{ flex: 1, background: "#009B3A" }} />
        </div>
      </div>
    ),
    size,
  );
}
