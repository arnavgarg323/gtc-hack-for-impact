"use client";

import { useState, useEffect } from "react";

interface Recall {
  firm: string;
  product: string;
  reason: string;
  classification: string;
  status: string;
  date: string;
  city: string;
  state: string;
  recall_number: string;
}

const CLS_COLOR: Record<string, string> = {
  "Class I": "var(--red)",
  "Class II": "var(--yellow)",
  "Class III": "#ecc94b",
};
const CLS_BG: Record<string, string> = {
  "Class I": "rgba(252,129,129,0.08)",
  "Class II": "rgba(236,201,75,0.08)",
  "Class III": "rgba(236,201,75,0.05)",
};
const CLS_DESC: Record<string, string> = {
  "Class I": "Health hazard",
  "Class II": "Remote hazard",
  "Class III": "Minor violation",
};

function formatDate(raw: string) {
  if (!raw) return "";
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : raw;
}

export default function RecallsTab() {
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/food-recalls")
      .then((r) => r.json())
      .then((d) => {
        setRecalls(d.recalls || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const displayed = filter
    ? recalls.filter((r) => r.classification?.includes(filter))
    : recalls;

  const counts = ["Class I", "Class II", "Class III"].map((c) => ({
    cls: c,
    n: recalls.filter((r) => r.classification === c).length,
  }));

  return (
    <div
      style={{
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        height: "100%",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            🚨 Live FDA Recalls
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
            OpenFDA · California distribution · live
          </div>
        </div>
        <div
          style={{
            fontSize: "9px",
            fontWeight: 700,
            color: "var(--red)",
            background: "rgba(252,129,129,0.1)",
            border: "1px solid rgba(252,129,129,0.3)",
            padding: "2px 7px",
            borderRadius: "8px",
            letterSpacing: "0.5px",
          }}
        >
          LIVE
        </div>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "6px" }} />
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "rgba(252,129,129,0.08)",
            border: "1px solid rgba(252,129,129,0.2)",
            borderRadius: "8px",
            padding: "12px",
            fontSize: "12px",
            color: "var(--red)",
            textAlign: "center",
          }}
        >
          Unable to load recalls. Check network connection.
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "5px" }}>
            {counts.map(({ cls, n }) => (
              <div
                key={cls}
                style={{
                  background: CLS_BG[cls] || "rgba(45,49,72,0.3)",
                  border: `1px solid ${CLS_COLOR[cls] || "var(--border)"}33`,
                  borderRadius: "6px",
                  padding: "8px 6px",
                  textAlign: "center",
                  cursor: "pointer",
                }}
                onClick={() => setFilter(filter === cls ? "" : cls)}
              >
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 800,
                    color: CLS_COLOR[cls] || "var(--text-primary)",
                    fontFamily: "var(--font-jetbrains), monospace",
                  }}
                >
                  {n}
                </div>
                <div
                  style={{
                    fontSize: "8px",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-jetbrains), monospace",
                    textTransform: "uppercase",
                    letterSpacing: "0.3px",
                  }}
                >
                  {cls}
                </div>
                <div style={{ fontSize: "8px", color: "var(--text-muted)", marginTop: "1px" }}>
                  {CLS_DESC[cls]}
                </div>
              </div>
            ))}
          </div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
            {["", "Class I", "Class II", "Class III"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: "10px",
                  padding: "3px 10px",
                  borderRadius: "10px",
                  border: `1px solid ${filter === f ? "var(--red)" : "var(--border)"}`,
                  background: filter === f ? "rgba(252,129,129,0.12)" : "transparent",
                  color: filter === f ? "var(--red)" : "var(--text-muted)",
                  cursor: "pointer",
                  fontFamily: "var(--font-jetbrains), monospace",
                  letterSpacing: "0.3px",
                }}
              >
                {f || "All"}
              </button>
            ))}
          </div>

          {/* Recall cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {displayed.map((r, i) => {
              const col = CLS_COLOR[r.classification] || "var(--text-muted)";
              const bg = CLS_BG[r.classification] || "rgba(45,49,72,0.1)";
              const isActive = r.status !== "Terminated";
              return (
                <div
                  key={i}
                  style={{
                    background: bg,
                    border: `1px solid ${col}33`,
                    borderLeft: `3px solid ${col}`,
                    borderRadius: "6px",
                    padding: "9px 10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "4px",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        color: col,
                        fontFamily: "var(--font-jetbrains), monospace",
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                        flexShrink: 0,
                      }}
                    >
                      {r.classification || "?"}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        alignItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isActive && (
                        <span
                          style={{
                            fontSize: "8px",
                            background: "rgba(252,129,129,0.15)",
                            color: "var(--red)",
                            border: "1px solid rgba(252,129,129,0.3)",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            fontFamily: "var(--font-jetbrains), monospace",
                          }}
                        >
                          ACTIVE
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "9px",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-jetbrains), monospace",
                        }}
                      >
                        {formatDate(r.date)}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-primary)",
                      lineHeight: 1.4,
                      marginBottom: "3px",
                    }}
                  >
                    {r.product?.slice(0, 110)}
                    {r.product?.length > 110 ? "…" : ""}
                  </div>

                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--text-secondary)",
                      marginBottom: "3px",
                    }}
                  >
                    🏢 {r.firm}
                    {r.city ? `, ${r.city}` : ""}
                  </div>

                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                      lineHeight: 1.3,
                    }}
                  >
                    {r.reason?.slice(0, 130)}
                    {r.reason?.length > 130 ? "…" : ""}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "9px",
              color: "var(--text-muted)",
              textAlign: "center",
              paddingBottom: "8px",
            }}
          >
            Source: OpenFDA enforcement reports · {recalls.length} recalls loaded
          </div>
        </>
      )}
    </div>
  );
}
