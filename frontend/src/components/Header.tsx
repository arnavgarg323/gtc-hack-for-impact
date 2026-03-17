"use client";

import { useStats } from "@/hooks/useStats";

export default function Header() {
  const { stats, loading } = useStats();

  return (
    <header
      style={{
        background: "var(--bg-panel)",
        borderBottom: "1px solid var(--border)",
        padding: "0 16px",
        height: "56px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0px" }}>
          <span
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--accent)",
              letterSpacing: "-0.3px",
            }}
          >
            Safe
          </span>
          <span
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--blue)",
              letterSpacing: "-0.3px",
            }}
          >
            Eats
          </span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--text-muted)",
              marginLeft: "4px",
              letterSpacing: "0.5px",
            }}
          >
            SCC
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: "9px",
            color: "var(--text-muted)",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}
        >
          Food Safety AI · Santa Clara County
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: "1px",
          height: "32px",
          background: "var(--border)",
          flexShrink: 0,
        }}
      />

      {/* GPU Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "5px 10px",
          flexShrink: 0,
        }}
      >
        <div className="pulse-dot" />
        <div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
          >
            DGX Spark
          </div>
          <div
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "9px",
              color: "var(--text-muted)",
              letterSpacing: "0.3px",
            }}
          >
            GB10 · Nemotron-Nano · cuOpt
          </div>
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: "1px",
          height: "32px",
          background: "var(--border)",
          flexShrink: 0,
        }}
      />

      {/* Stats Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ width: "60px", height: "26px", borderRadius: "6px" }}
              />
            ))}
          </>
        ) : (
          <>
            <StatPill
              color="var(--green)"
              dimColor="var(--green-dim)"
              borderColor="rgba(92,200,138,0.3)"
              label="Safe"
              value={stats.green}
            />
            <StatPill
              color="var(--yellow)"
              dimColor="var(--yellow-dim)"
              borderColor="rgba(240,192,96,0.3)"
              label="Fair"
              value={stats.yellow}
            />
            <StatPill
              color="var(--red)"
              dimColor="var(--red-dim)"
              borderColor="rgba(240,112,112,0.3)"
              label="Poor"
              value={stats.red}
            />
            <StatPill
              color="var(--blue)"
              dimColor="var(--blue-dim)"
              borderColor="rgba(91,156,246,0.3)"
              label="Total"
              value={stats.total}
            />
          </>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Last updated indicator */}
      <div
        style={{
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: "10px",
          color: "var(--text-muted)",
        }}
      >
        Live
      </div>
    </header>
  );
}

function StatPill({
  color,
  dimColor,
  borderColor,
  label,
  value,
}: {
  color: string;
  dimColor: string;
  borderColor: string;
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: dimColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "6px",
        padding: "3px 8px",
        display: "flex",
        alignItems: "center",
        gap: "5px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: "10px",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: "12px",
          fontWeight: 600,
          color,
        }}
      >
        {value.toLocaleString()}
      </span>
    </div>
  );
}
