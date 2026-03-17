"use client";

import { useState, useEffect } from "react";
import type { TrendPoint, ViolationType } from "@/types";

export default function TrendsTab() {
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [violations, setViolations] = useState<ViolationType[]>([]);
  const [loadingT, setLoadingT] = useState(true);
  const [loadingV, setLoadingV] = useState(true);

  useEffect(() => {
    fetch("/api/trends")
      .then((r) => r.json())
      .then((d) => {
        setTrends(Array.isArray(d) ? d : d.trends || []);
        setLoadingT(false);
      })
      .catch(() => setLoadingT(false));

    fetch("/api/violation-types")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : d.violations || d.types || [];
        setViolations(list.slice(0, 15));
        setLoadingV(false);
      })
      .catch(() => setLoadingV(false));
  }, []);

  const maxViolationCount = Math.max(...violations.map((v) => v.count), 1);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowY: "auto",
        padding: "12px",
        gap: "16px",
      }}
    >
      {/* Trends section */}
      <div>
        <SectionLabel>Inspection Score Trends</SectionLabel>
        {loadingT ? (
          <div className="skeleton" style={{ height: "80px", marginTop: "8px" }} />
        ) : trends.length === 0 ? (
          <EmptyState message="No trend data available" />
        ) : (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "12px",
              marginTop: "8px",
            }}
          >
            {/* Bar chart */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "4px",
                height: "80px",
              }}
            >
              {trends.map((t) => {
                const score = t.avg_score || 0;
                const height = (score / 100) * 80;
                const color =
                  score >= 90
                    ? "var(--green)"
                    : score >= 70
                    ? "var(--yellow)"
                    : "var(--red)";
                return (
                  <div
                    key={t.month}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "2px",
                      position: "relative",
                    }}
                    title={`${t.month}: ${score.toFixed(1)} avg (${t.count} inspections)`}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: `${height}px`,
                        background: color,
                        borderRadius: "2px 2px 0 0",
                        opacity: 0.8,
                        minHeight: "3px",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            {/* Month labels */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                marginTop: "4px",
              }}
            >
              {trends.map((t) => (
                <div
                  key={t.month}
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: "8px",
                    color: "var(--text-muted)",
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "clip",
                  }}
                >
                  {t.month?.slice(-5) || t.month}
                </div>
              ))}
            </div>
            {/* Score range info */}
            <div
              style={{
                marginTop: "8px",
                display: "flex",
                gap: "12px",
              }}
            >
              {[
                { color: "var(--green)", label: "90+" },
                { color: "var(--yellow)", label: "70–89" },
                { color: "var(--red)", label: "<70" },
              ].map((l) => (
                <div
                  key={l.label}
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      background: l.color,
                      borderRadius: "2px",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: "9px",
                      color: "var(--text-muted)",
                    }}
                  >
                    {l.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Violation types */}
      <div>
        <SectionLabel>Top 15 Violation Types</SectionLabel>
        {loadingV ? (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "30px" }} />
            ))}
          </div>
        ) : violations.length === 0 ? (
          <EmptyState message="No violation data available" />
        ) : (
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {violations.map((v, i) => {
              const barPct = (v.count / maxViolationCount) * 100;
              const critPct = v.pct_critical ?? 0;
              const critColor =
                critPct >= 50
                  ? "var(--red)"
                  : critPct >= 25
                  ? "var(--yellow)"
                  : "var(--text-muted)";
              return (
                <div
                  key={i}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "5px",
                    padding: "6px 10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        marginRight: "8px",
                      }}
                    >
                      {v.description}
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-jetbrains), monospace",
                          fontSize: "10px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {v.count.toLocaleString()}
                      </span>
                      {v.pct_critical != null && (
                        <span
                          style={{
                            fontFamily: "var(--font-jetbrains), monospace",
                            fontSize: "9px",
                            color: critColor,
                          }}
                        >
                          {critPct.toFixed(0)}% crit
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Bar */}
                  <div
                    style={{
                      height: "3px",
                      background: "var(--bg-base)",
                      borderRadius: "2px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${barPct}%`,
                        background:
                          critPct >= 50
                            ? "var(--red)"
                            : critPct >= 25
                            ? "var(--yellow)"
                            : "var(--blue)",
                        borderRadius: "2px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-jetbrains), monospace",
        fontSize: "10px",
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.8px",
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "20px",
        textAlign: "center",
        color: "var(--text-muted)",
        fontSize: "12px",
        marginTop: "8px",
      }}
    >
      {message}
    </div>
  );
}
