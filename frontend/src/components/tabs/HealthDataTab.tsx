"use client";

import { useState, useRef } from "react";
import type { HealthDataPoint } from "@/types";

interface HealthDataTabProps {
  onShowHealthLayer: (metric: string, data: HealthDataPoint[]) => void;
}

const METRICS = [
  {
    id: "food_insecurity",
    label: "Food Insecurity",
    icon: "🍽️",
    source: "health",
    field: "food_insecurity_pct",
    color: "var(--red)",
  },
  {
    id: "diabetes",
    label: "Diabetes",
    icon: "💉",
    source: "health",
    field: "diabetes_pct",
    color: "var(--yellow)",
  },
  {
    id: "obesity",
    label: "Obesity",
    icon: "⚕️",
    source: "health",
    field: "obesity_pct",
    color: "var(--orange, #f08040)",
  },
  {
    id: "pollution",
    label: "Pollution Burden",
    icon: "🏭",
    source: "calenviroscreen",
    field: "ces_score",
    color: "var(--purple)",
  },
  {
    id: "depression",
    label: "Depression",
    icon: "🧠",
    source: "health",
    field: "depression_pct",
    color: "var(--blue)",
  },
  {
    id: "no_transport",
    label: "No Transport",
    icon: "🚌",
    source: "health",
    field: "lack_transport_pct",
    color: "var(--text-secondary)",
  },
];

interface MetricResult {
  id: string;
  data: HealthDataPoint[];
  stats?: {
    avg: number;
    min: number;
    max: number;
    count: number;
  };
}

export default function HealthDataTab({ onShowHealthLayer }: HealthDataTabProps) {
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<MetricResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cache fetched data to avoid re-fetching
  const healthCache = useRef<Array<Record<string, unknown>> | null>(null);
  const calenviroCache = useRef<Array<Record<string, unknown>> | null>(null);

  async function loadMetric(metric: (typeof METRICS)[0]) {
    setLoading(metric.id);
    setError(null);
    try {
      let tracts: Array<Record<string, unknown>>;

      if (metric.source === "health") {
        if (!healthCache.current) {
          const r = await fetch("/api/health-outcomes");
          const d = await r.json();
          healthCache.current = Array.isArray(d) ? d : (d.tracts || d.data || d.results || []);
        }
        tracts = healthCache.current!;
      } else {
        if (!calenviroCache.current) {
          const r = await fetch("/api/calenviroscreen");
          const d = await r.json();
          calenviroCache.current = Array.isArray(d) ? d : (d.tracts || d.data || d.results || []);
        }
        tracts = calenviroCache.current!;
      }

      const data: HealthDataPoint[] = tracts
        .map((tract) => ({
          value: tract[metric.field] as number,
          geoid: tract.geoid as string,
          label: tract.geoid as string,
        }))
        .filter((p) => p.value != null && !isNaN(p.value));

      const values = data.map((p) => p.value).filter((v) => v != null && !isNaN(v));
      const stats = values.length
        ? {
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            count: values.length,
          }
        : undefined;

      setResult({ id: metric.id, data, stats });
      setActiveMetric(metric.id);
      onShowHealthLayer(metric.id, data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(null);
    }
  }

  const activeMeta = METRICS.find((m) => m.id === activeMetric);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowY: "auto",
        padding: "12px",
        gap: "12px",
      }}
    >
      {/* Header */}
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
          Health Data Layers
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
          CDC PLACES + CalEnviroScreen · Census Tracts
        </div>
      </div>

      {/* Metric buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
        {METRICS.map((metric) => {
          const isActive = activeMetric === metric.id;
          const isLoading = loading === metric.id;
          return (
            <button
              key={metric.id}
              onClick={() => loadMetric(metric)}
              disabled={isLoading}
              style={{
                background: isActive ? "var(--accent-dim)" : "var(--bg-card)",
                border: `1px solid ${isActive ? "rgba(118,185,0,0.3)" : "var(--border)"}`,
                borderRadius: "6px",
                padding: "10px 8px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s",
                textAlign: "left",
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: "16px" }}>{metric.icon}</span>
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--accent)" : "var(--text-primary)",
                  }}
                >
                  {isLoading ? "Loading..." : metric.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          style={{
            background: "var(--red-dim)",
            border: "1px solid rgba(240,112,112,0.3)",
            borderRadius: "6px",
            padding: "10px",
            fontSize: "12px",
            color: "var(--red)",
          }}
        >
          Error: {error}
        </div>
      )}

      {/* Stats card */}
      {result && result.stats && activeMeta && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "12px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "10px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              marginBottom: "10px",
            }}
          >
            {activeMeta.label} — Summary
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            {[
              { label: "Avg", value: result.stats.avg.toFixed(1) },
              { label: "Min", value: result.stats.min.toFixed(1) },
              { label: "Max", value: result.stats.max.toFixed(1) },
              { label: "Tracts", value: result.stats.count.toString() },
            ].map((s) => (
              <div key={s.label}>
                <div
                  style={{
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: "8px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: activeMeta.color,
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Top tracts */}
          {result.data.length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: "9px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "6px",
                }}
              >
                Top Areas (highest burden)
              </div>
              {[...result.data]
                .sort((a, b) => b.value - a.value)
                .slice(0, 5)
                .map((point, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "3px 0",
                      borderBottom: i < 4 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <span
                      style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                    >
                      {point.label || point.geoid || `Tract ${i + 1}`}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: activeMeta.color,
                      }}
                    >
                      {point.value.toFixed(1)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Hint */}
      {!activeMetric && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "12px",
            fontSize: "12px",
            color: "var(--text-secondary)",
            lineHeight: "1.5",
          }}
        >
          Select a health metric above to overlay census-tract level data on the map.
          Data sourced from CDC PLACES 2023 and CalEnviroScreen 4.0.
        </div>
      )}
    </div>
  );
}
