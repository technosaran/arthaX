import { ImageResponse } from "next/og";

export const alt = "arthaX — Sovereign Wealth & Portfolio Intelligence Platform";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#07080c",
          padding: "60px 80px",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          position: "relative",
        }}
      >
        {/* Subtle Ambient Glow Effect */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            backgroundColor: "rgba(16, 185, 129, 0.12)",
            filter: "blur(90px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            left: "-100px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            backgroundColor: "rgba(56, 189, 248, 0.08)",
            filter: "blur(90px)",
          }}
        />

        {/* Top Header: Logo + Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                border: "1.5px solid rgba(16, 185, 129, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10b981",
                fontSize: "24px",
                fontWeight: "bold",
              }}
            >
              X
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "30px",
                  fontWeight: 900,
                  letterSpacing: "-0.04em",
                  color: "#f8fafc",
                }}
              >
                artha<span style={{ color: "#10b981" }}>X</span>
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  color: "rgba(248, 250, 252, 0.5)",
                  textTransform: "uppercase",
                }}
              >
                Sovereign Wealth Intelligence
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 18px",
              borderRadius: "9999px",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#34d399",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#10b981",
              }}
            />
            <span>Institutional FinTech</span>
          </div>
        </div>

        {/* Center Content: Headline & Pillars */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            maxWidth: "960px",
          }}
        >
          <h1
            style={{
              fontSize: "52px",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Multi-Asset Wealth & Real-Time Portfolio Intelligence
          </h1>
          <p
            style={{
              fontSize: "22px",
              lineHeight: 1.45,
              color: "rgba(248, 250, 252, 0.7)",
              margin: 0,
            }}
          >
            Comprehensive capital management across Equities, AMFI Mutual Funds, SGB Bonds,
            Physical Bullion, F&O derivatives, and unified family office accounts.
          </p>
        </div>

        {/* Bottom Feature Badges & Domain Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            paddingTop: "24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ display: "flex", gap: "12px" }}>
            {["Zerodha Auto-Sync", "AMFI Live NAV", "Gold & Silver Bullion", "Zero-Knowledge RLS"].map(
              (pill) => (
                <div
                  key={pill}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "rgba(248, 250, 252, 0.85)",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  {pill}
                </div>
              )
            )}
          </div>

          <span
            style={{
              fontSize: "16px",
              fontFamily: "monospace",
              color: "rgba(248, 250, 252, 0.6)",
              fontWeight: 600,
            }}
          >
            arthax.vercel.app
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
