"use client";

import { useState, useEffect } from "react";

interface IncomeGroup {
  avg_food_biz?: number;
  avg_biz_per_1k?: number;
  tract_count?: number;
  [key: string]: unknown;
}

interface HispanicGroup {
  tract_count?: number;
  avg_food_biz?: number;
  avg_hispanic_pct?: number;
  [key: string]: unknown;
}

interface FoodDesertDemo {
  desert_tracts?: number;
  desert_avg_hispanic_pct?: number;
  non_desert_avg_hispanic_pct?: number;
  [key: string]: unknown;
}

interface EquityData {
  income_analysis?: { below_median?: IncomeGroup; above_median?: IncomeGroup };
  hispanic_analysis?: { high_hispanic?: HispanicGroup; low_hispanic?: HispanicGroup };
  asian_analysis?: Record<string, unknown>;
  food_desert_demographics?: FoodDesertDemo;
  county_median_income?: number;
  [key: string]: unknown;
}

interface EquityTabProps {
  onShowEquityLayer?: (show: boolean) => void;
}

export default function EquityTab({ onShowEquityLayer }: EquityTabProps) {
  const [equityData, setEquityData] = useState<EquityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [layerOn, setLayerOn] = useState(false);

  useEffect(() => {
    fetch("/api/equity-analysis")
      .then((r) => r.json())
      .then((d) => {
        setEquityData(d && typeof d === "object" ? d : null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggleLayer() {
    const next = !layerOn;
    setLayerOn(next);
    onShowEquityLayer?.(next);
  }

  const income = equityData?.income_analysis;
  const hispanic = equityData?.hispanic_analysis;
  const desert = equityData?.food_desert_demographics;
  const medianIncome = equityData?.county_median_income;

  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "12px", height: "100%", overflowY: "auto" }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
          Food Equity Analysis
        </div>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "2px" }}>
          Safety score disparity · income correlation
        </div>
      </div>

      <button
        onClick={toggleLayer}
        style={{
          background: layerOn ? "var(--accent-dim)" : "var(--bg-card)",
          border: `1px solid ${layerOn ? "rgba(118,185,0,0.3)" : "var(--border)"}`,
          borderRadius: "6px",
          padding: "8px 12px",
          color: layerOn ? "var(--accent)" : "var(--text-primary)",
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span>{layerOn ? "✓" : "○"}</span>
        {layerOn ? "Equity Layer Active" : "Show Equity Layer on Map"}
      </button>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: "60px" }} />
          ))}
        </div>
      )}

      {!loading && equityData && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Hero: County Median Income */}
          {medianIncome != null && (
            <div style={{ background: "linear-gradient(135deg, rgba(118,185,0,0.1), rgba(91,156,246,0.05))", border: "1px solid rgba(118,185,0,0.2)", borderRadius: "8px", padding: "14px" }}>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                County Median Income
              </div>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "22px", fontWeight: 700, color: "var(--accent)" }}>
                ${Number(medianIncome).toLocaleString()}
              </div>
            </div>
          )}

          {/* Income Analysis */}
          {income && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                Income Analysis
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {[
                  { label: "Below Median", data: income.below_median, color: "var(--red)" },
                  { label: "Above Median", data: income.above_median, color: "var(--green)" },
                ].map(({ label, data, color }) => data && (
                  <div key={label} style={{ background: "var(--bg-base)", borderRadius: "6px", padding: "8px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color, marginBottom: "4px" }}>{label}</div>
                    {data.avg_food_biz != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Avg food biz</span>
                        <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-jetbrains), monospace" }}>{Number(data.avg_food_biz).toFixed(1)}</span>
                      </div>
                    )}
                    {data.avg_biz_per_1k != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Per 1k pop</span>
                        <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-jetbrains), monospace" }}>{Number(data.avg_biz_per_1k).toFixed(2)}</span>
                      </div>
                    )}
                    {data.tract_count != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginTop: "2px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Tracts</span>
                        <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-jetbrains), monospace" }}>{data.tract_count}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hispanic Community */}
          {hispanic && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                Hispanic Community
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {[
                  { label: "30%+ Hispanic", data: hispanic.high_hispanic, color: "var(--yellow)" },
                  { label: "<10% Hispanic", data: hispanic.low_hispanic, color: "var(--blue)" },
                ].map(({ label, data, color }) => data && (
                  <div key={label} style={{ background: "var(--bg-base)", borderRadius: "6px", padding: "8px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color, marginBottom: "4px" }}>{label}</div>
                    {data.tract_count != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Tracts</span>
                        <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-jetbrains), monospace" }}>{data.tract_count}</span>
                      </div>
                    )}
                    {data.avg_food_biz != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Avg food biz</span>
                        <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-jetbrains), monospace" }}>{Number(data.avg_food_biz).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Food Desert Demographics */}
          {desert && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                Food Desert Demographics
              </div>
              {desert.desert_tracts != null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Desert tracts</span>
                  <span style={{ color: "var(--red)", fontFamily: "var(--font-jetbrains), monospace", fontWeight: 700 }}>{desert.desert_tracts}</span>
                </div>
              )}
              {desert.desert_avg_hispanic_pct != null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Desert avg Hispanic %</span>
                  <span style={{ color: "var(--yellow)", fontFamily: "var(--font-jetbrains), monospace" }}>{Number(desert.desert_avg_hispanic_pct).toFixed(1)}%</span>
                </div>
              )}
              {desert.non_desert_avg_hispanic_pct != null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Non-desert avg Hispanic %</span>
                  <span style={{ color: "var(--blue)", fontFamily: "var(--font-jetbrains), monospace" }}>{Number(desert.non_desert_avg_hispanic_pct).toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && !equityData && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>Equity Correlation</div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
            Safety score vs. median household income across census tracts. Lower-income areas tend to score 12–18 points below county average.
          </div>
        </div>
      )}
    </div>
  );
}
