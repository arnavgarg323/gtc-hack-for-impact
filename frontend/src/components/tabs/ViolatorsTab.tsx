"use client";

import { useState, useEffect } from "react";
import type { Violator } from "@/types";

interface ViolatorsTabProps {
  onPanTo: (lat: number, lon: number) => void;
}

export default function ViolatorsTab({ onPanTo }: ViolatorsTabProps) {
  const [violators, setViolators] = useState<Violator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | number | null>(null);

  useEffect(() => {
    fetch("/api/worst-violators")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : d.violators || d.results || [];
        setViolators(list.slice(0, 15));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error)
    return (
      <div style={{ padding: "16px", color: "var(--red)", fontSize: "13px" }}>
        Error: {error}
      </div>
    );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
          Top 15 Worst Violators
        </div>
        <div
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: "9px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginTop: "2px",
          }}
        >
          Most critical violations · Santa Clara County
        </div>
      </div>

      {/* List */}
      <div
        style={{
          overflowY: "auto",
          flex: 1,
          padding: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {violators.map((v, i) => {
          const rank = v.rank ?? i + 1;
          const isSelected = selected === v.id;
          const scoreColor =
            (v.score ?? 0) >= 90
              ? "var(--green)"
              : (v.score ?? 0) >= 70
              ? "var(--yellow)"
              : "var(--red)";

          return (
            <div
              key={v.id}
              onClick={() => {
                setSelected(v.id);
                if (v.lat && v.lon) onPanTo(v.lat, v.lon);
              }}
              style={{
                background: isSelected ? "rgba(240,112,112,0.08)" : "var(--bg-card)",
                border: `1px solid ${isSelected ? "rgba(240,112,112,0.25)" : "var(--border)"}`,
                borderRadius: "6px",
                padding: "8px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.15s",
              }}
            >
              {/* Rank */}
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: rank <= 3 ? "var(--red)" : "var(--text-muted)",
                  width: "20px",
                  flexShrink: 0,
                  textAlign: "center",
                }}
              >
                #{rank}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {v.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: "10px",
                    color: "var(--text-muted)",
                  }}
                >
                  {v.city || "Unknown"}
                  {v.address ? ` · ${v.address}` : ""}
                </div>
              </div>

              {/* Critical count badge */}
              <div
                style={{
                  background: "var(--red-dim)",
                  border: "1px solid rgba(240,112,112,0.3)",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--red)",
                  flexShrink: 0,
                }}
              >
                {v.critical_count}
              </div>

              {/* Score */}
              {v.score != null && (
                <div
                  style={{
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: scoreColor,
                    flexShrink: 0,
                    width: "30px",
                    textAlign: "right",
                  }}
                >
                  {v.score}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: "9px",
            color: "var(--text-muted)",
          }}
        >
          <span style={{ color: "var(--red)" }}>■ </span>Critical violations count
        </div>
        <div
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: "9px",
            color: "var(--text-muted)",
          }}
        >
          Score →
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: "50px" }} />
      ))}
    </div>
  );
}
