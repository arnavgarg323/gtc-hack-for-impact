"use client";

import { useState } from "react";
import type { Route } from "@/types";

interface RoutesTabProps {
  onDrawRoutes: (routes: Route[]) => void;
}

const CITIES_OPTIONS = [
  "San Jose",
  "Santa Clara",
  "Sunnyvale",
  "Mountain View",
  "Palo Alto",
  "Milpitas",
  "Fremont",
  "Campbell",
  "Los Gatos",
  "Cupertino",
];

const PRIORITY_OPTIONS = [
  { value: "critical", label: "Critical Violations First" },
  { value: "low_score", label: "Lowest Score First" },
  { value: "overdue", label: "Overdue Inspections" },
  { value: "random", label: "Random Sample" },
];

const ROUTE_COLORS = [
  "#76b900",
  "#5b9cf6",
  "#b89cf6",
  "#f0c060",
  "#5cc88a",
  "#f07070",
];

export default function RoutesTab({ onDrawRoutes }: RoutesTabProps) {
  const [city, setCity] = useState("San Jose");
  const [inspectors, setInspectors] = useState(3);
  const [stops, setStops] = useState(8);
  const [priority, setPriority] = useState("critical");
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function optimizeRoutes() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/optimize-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, inspectors, stops_per_inspector: stops, priority }),
      });
      const d = await r.json();
      const routeList: Route[] = (Array.isArray(d) ? d : d.routes || []).map(
        (route: Route, i: number) => ({
          ...route,
          color: ROUTE_COLORS[i % ROUTE_COLORS.length],
        })
      );
      setRoutes(routeList);
      onDrawRoutes(routeList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to optimize routes");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Config */}
      <div
        style={{
          padding: "12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            Route Optimizer
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
            Powered by NVIDIA cuOpt
          </div>
        </div>

        <div>
          <label
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "9px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              display: "block",
              marginBottom: "4px",
            }}
          >
            City
          </label>
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <div>
            <label
              style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: "9px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Inspectors
            </label>
            <select
              value={inspectors}
              onChange={(e) => setInspectors(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} inspector{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: "9px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Stops Each
            </label>
            <select value={stops} onChange={(e) => setStops(Number(e.target.value))}>
              {[4, 6, 8, 10, 12, 15].map((n) => (
                <option key={n} value={n}>
                  {n} stops
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "9px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Priority
          </label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={optimizeRoutes}
          className="btn-accent"
          disabled={loading}
          style={{ width: "100%" }}
        >
          {loading ? "Optimizing with cuOpt..." : "Optimize Routes"}
        </button>
      </div>

      {error && (
        <div
          style={{
            margin: "8px 12px",
            background: "var(--red-dim)",
            border: "1px solid rgba(240,112,112,0.3)",
            borderRadius: "6px",
            padding: "8px 10px",
            fontSize: "12px",
            color: "var(--red)",
          }}
        >
          {error}
        </div>
      )}

      {/* Routes list */}
      {routes.length > 0 && (
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 12px" }}>
          <div
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "10px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              marginBottom: "8px",
            }}
          >
            {routes.length} Inspector Route{routes.length !== 1 ? "s" : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {routes.map((route, i) => (
              <div
                key={i}
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${route.color || "var(--border)"}40`,
                  borderLeft: `3px solid ${route.color || "var(--accent)"}`,
                  borderRadius: "6px",
                  padding: "8px 10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: route.color || "var(--accent)",
                    }}
                  >
                    Inspector {route.inspector ?? i + 1}
                  </span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: "10px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {route.stops?.length ?? 0} stops
                    </span>
                    {route.total_distance != null && (
                      <span
                        style={{
                          fontFamily: "var(--font-jetbrains), monospace",
                          fontSize: "10px",
                          color: "var(--text-muted)",
                        }}
                      >
                        {route.total_distance.toFixed(1)} mi
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {route.stops?.map((stop, j) => (
                    <div
                      key={j}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "2px 0",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-jetbrains), monospace",
                          fontSize: "9px",
                          color: "var(--text-muted)",
                          width: "16px",
                          flexShrink: 0,
                        }}
                      >
                        {j + 1}.
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {stop.name}
                      </span>
                      {stop.score != null && (
                        <span
                          style={{
                            fontFamily: "var(--font-jetbrains), monospace",
                            fontSize: "10px",
                            color:
                              stop.score >= 90
                                ? "var(--green)"
                                : stop.score >= 70
                                ? "var(--yellow)"
                                : "var(--red)",
                            flexShrink: 0,
                          }}
                        >
                          {stop.score}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && routes.length === 0 && (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>🗺️</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Configure route parameters above and click Optimize Routes to generate
              inspection schedules using NVIDIA cuOpt.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
