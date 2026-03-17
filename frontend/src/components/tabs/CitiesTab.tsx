"use client";

import { useState, useEffect } from "react";
import type { CityStats } from "@/types";

export default function CitiesTab() {
  const [cities, setCities] = useState<CityStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "count" | "name">("score");

  useEffect(() => {
    fetch("/api/by-city")
      .then((r) => r.json())
      .then((d) => {
        const list: CityStats[] = Array.isArray(d) ? d : d.cities || d.results || [];
        setCities(list.filter((c) => (c.count || 0) >= 5));
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

  const sorted = [...cities].sort((a, b) => {
    if (sortBy === "score") return b.avg_score - a.avg_score;
    if (sortBy === "count") return b.count - a.count;
    return a.city.localeCompare(b.city);
  });

  const maxScore = 100;

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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            Safety by City
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
            {sorted.length} cities · min 5 restaurants
          </div>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "score" | "count" | "name")}
          style={{
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: "5px",
            color: "var(--text-secondary)",
            fontSize: "11px",
            padding: "4px 8px",
            width: "auto",
            fontFamily: "var(--font-jetbrains), monospace",
          }}
        >
          <option value="score">By Score</option>
          <option value="count">By Count</option>
          <option value="name">By Name</option>
        </select>
      </div>

      {/* List */}
      <div style={{ overflowY: "auto", flex: 1, padding: "8px 12px" }}>
        {sorted.map((city, i) => {
          const score = city.avg_score || 0;
          const barColor =
            score >= 90
              ? "var(--green)"
              : score >= 70
              ? "var(--yellow)"
              : "var(--red)";
          const pct = (score / maxScore) * 100;

          return (
            <div key={city.city} style={{ marginBottom: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: "10px",
                      color: "var(--text-muted)",
                      width: "18px",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {city.city}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: "10px",
                      color: "var(--text-muted)",
                    }}
                  >
                    {city.count} restaurants
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: barColor,
                    }}
                  >
                    {score.toFixed(1)}
                  </span>
                </div>
              </div>
              {/* Bar */}
              <div
                style={{
                  height: "5px",
                  background: "var(--bg-base)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: barColor,
                    borderRadius: "3px",
                    transition: "width 0.4s ease",
                    opacity: 0.8,
                  }}
                />
              </div>
              {/* Sub stats */}
              {(city.green != null || city.yellow != null || city.red != null) && (
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "3px",
                  }}
                >
                  {city.green != null && (
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: "9px",
                        color: "var(--green)",
                      }}
                    >
                      {city.green}G
                    </span>
                  )}
                  {city.yellow != null && (
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: "9px",
                        color: "var(--yellow)",
                      }}
                    >
                      {city.yellow}Y
                    </span>
                  )}
                  {city.red != null && (
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: "9px",
                        color: "var(--red)",
                      }}
                    >
                      {city.red}R
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i}>
          <div
            style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}
          >
            <div className="skeleton" style={{ height: "14px", width: "40%" }} />
            <div className="skeleton" style={{ height: "14px", width: "20%" }} />
          </div>
          <div className="skeleton" style={{ height: "5px" }} />
        </div>
      ))}
    </div>
  );
}
