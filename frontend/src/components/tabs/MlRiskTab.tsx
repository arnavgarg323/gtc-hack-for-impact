"use client";

import { useState, useEffect } from "react";

interface RiskEntry {
  id?: string | number;
  name?: string;
  city?: string;
  score?: number;
  risk_score?: number;
  risk_level?: string;
  risk_tier?: string;
  predicted_violations?: number;
  days_since_inspection?: number;
  lat?: number;
  lon?: number;
  geoid?: string;
  total_population?: number;
  poverty_rate_pct?: number;
  biz_per_1k_pop?: number;
  centroid_lat?: number;
  centroid_lon?: number;
  [key: string]: unknown;
}

export default function MlRiskTab() {
  const [data, setData] = useState<RiskEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ml-risk")
      .then((r) => r.json())
      .then((d) => {
        setData(Array.isArray(d) ? d : d.tracts || d.data || d.results || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "12px", height: "100%", overflowY: "auto" }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>ML Risk Scoring</div>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "2px" }}>
          Predictive violation risk · Nemotron-Nano inference
        </div>
      </div>

      <div style={{ background: "linear-gradient(135deg, rgba(184,156,246,0.08), rgba(91,156,246,0.05))", border: "1px solid rgba(184,156,246,0.2)", borderRadius: "8px", padding: "12px" }}>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Model Architecture</div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
          Gradient boosting + NVIDIA Nemotron-Nano embeddings trained on 3 years of inspection history.
          Features: violation history, cuisine type, inspection frequency, neighborhood demographics.
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: "44px" }} />)}
        </div>
      ) : data.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
            High Risk Predictions
          </div>
          {data.slice(0, 20).map((item, i) => {
            const tier = (item.risk_tier || item.risk_level || "").toLowerCase();
            const risk = item.risk_score ?? item.score ?? 0;
            const tierColorMap: Record<string, string> = {
              critical: "#f07070",
              high: "#f6ad55",
              moderate: "#fbd38d",
              low: "#68d391",
              minimal: "#4299e1",
            };
            const riskColor = tierColorMap[tier] || (risk >= 0.7 ? "#f07070" : risk >= 0.4 ? "#f6ad55" : "#68d391");
            const level = item.risk_tier || item.risk_level || (risk >= 0.7 ? "HIGH" : risk >= 0.4 ? "MEDIUM" : "LOW");
            const displayName = item.name || item.geoid || `Tract ${item.id || i + 1}`;
            const subtitle = item.city || (item.poverty_rate_pct != null ? `Poverty: ${Number(item.poverty_rate_pct).toFixed(1)}%` : null);
            return (
              <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "5px", padding: "8px 10px", display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: riskColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayName}
                  </div>
                  {subtitle && <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)" }}>{subtitle}</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "11px", fontWeight: 700, color: riskColor }}>{(Number(risk) * 100).toFixed(0)}%</div>
                  <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "8px", color: riskColor, textTransform: "uppercase" }}>{level}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "6px", padding: "14px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
          ML risk scoring uses historical inspection data, violation patterns, and neighborhood
          demographics to predict which restaurants are most likely to fail upcoming inspections.
          Connect to the Flask backend to see live predictions.
        </div>
      )}
    </div>
  );
}
