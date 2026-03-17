"use client";

import { useState, useEffect } from "react";
import type { DesertStats, DesertTract } from "@/types";

interface DesertsTabProps {
  onFlyTo: (lat: number, lon: number) => void;
}

export default function DesertsTab({ onFlyTo }: DesertsTabProps) {
  const [data, setData] = useState<DesertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/food-deserts")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
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
        Error loading food desert data: {error}
      </div>
    );
  if (!data)
    return (
      <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px" }}>
        No data available
      </div>
    );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "12px",
        overflowY: "auto",
        height: "100%",
      }}
    >
      {/* Section header */}
      <SectionHeader
        icon="🗺️"
        title="Food Desert Analysis"
        subtitle="USDA criteria · Santa Clara County"
      />

      {/* Hero card */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(240,112,112,0.08), rgba(240,192,96,0.06))",
          border: "1px solid rgba(240,112,112,0.2)",
          borderRadius: "8px",
          padding: "14px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: "10px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            marginBottom: "6px",
          }}
        >
          Population in Food Deserts
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--red)",
              fontFamily: "var(--font-jetbrains), monospace",
            }}
          >
            {(data.total_population_affected || 0).toLocaleString()}
          </span>
          <span
            style={{
              fontSize: "16px",
              color: "var(--yellow)",
              fontFamily: "var(--font-jetbrains), monospace",
            }}
          >
            {(data.pct_population || 0).toFixed(1)}%
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
          of Santa Clara County residents lack adequate food access
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <StatCard
          label="Desert Tracts"
          value={data.desert_tracts || 0}
          color="var(--red)"
          dimColor="var(--red-dim)"
        />
        <StatCard
          label="Severe"
          value={data.severe_deserts || 0}
          color="var(--yellow)"
          dimColor="var(--yellow-dim)"
        />
        <StatCard
          label="Low Access"
          value={data.low_access_tracts || 0}
          color="var(--purple)"
          dimColor="var(--purple-dim)"
        />
        <StatCard
          label="Zero Businesses"
          value={data.zero_business_tracts || 0}
          color="var(--text-muted)"
          dimColor="rgba(68,80,106,0.15)"
        />
      </div>

      {/* Tract list */}
      {data.tracts && data.tracts.length > 0 && (
        <div>
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
            Desert Tracts ({data.tracts.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {data.tracts.map((tract) => (
              <TractRow
                key={tract.tract_id}
                tract={tract}
                selected={selected === tract.tract_id}
                onSelect={() => {
                  setSelected(tract.tract_id);
                  if (tract.lat && tract.lon) {
                    onFlyTo(tract.lat, tract.lon);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TractRow({
  tract,
  selected,
  onSelect,
}: {
  tract: DesertTract;
  selected: boolean;
  onSelect: () => void;
}) {
  const severityColor =
    tract.severity === "severe"
      ? "var(--red)"
      : tract.severity === "moderate"
      ? "var(--yellow)"
      : "var(--text-secondary)";

  return (
    <div
      onClick={onSelect}
      style={{
        background: selected ? "var(--accent-dim)" : "var(--bg-card)",
        border: `1px solid ${selected ? "rgba(118,185,0,0.3)" : "var(--border)"}`,
        borderRadius: "6px",
        padding: "8px 10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        transition: "all 0.15s",
      }}
    >
      {/* Severity indicator */}
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: severityColor,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-primary)",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {tract.name || `Tract ${tract.tract_id}`}
        </div>
        <div
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: "10px",
            color: "var(--text-muted)",
          }}
        >
          Pop: {(tract.population || 0).toLocaleString()}
          {tract.poverty_rate != null &&
            ` · ${(tract.poverty_rate * 100).toFixed(0)}% poverty`}
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: "10px",
          color: severityColor,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          flexShrink: 0,
        }}
      >
        {tract.severity}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  dimColor,
}: {
  label: string;
  value: number;
  color: string;
  dimColor: string;
}) {
  return (
    <div
      style={{
        background: dimColor,
        border: `1px solid ${color}30`,
        borderRadius: "6px",
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: "9px",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: "22px",
          fontWeight: 700,
          color,
        }}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {icon && <span style={{ fontSize: "14px" }}>{icon}</span>}
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {title}
        </span>
      </div>
      {subtitle && (
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
          {subtitle}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div className="skeleton" style={{ height: "20px", width: "60%" }} />
      <div className="skeleton" style={{ height: "80px" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: "60px" }} />
        ))}
      </div>
    </div>
  );
}
