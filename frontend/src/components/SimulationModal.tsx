"use client";

import { useState } from "react";

const TIER_LABEL: Record<string, { label: string; color: string }> = {
  high_equity: { label: "High Equity", color: "#4ADE80" },
  moderate_equity: { label: "Moderate Equity", color: "#FBBF24" },
  low_equity: { label: "Low Equity", color: "#FB923C" },
  critical_equity_gap: { label: "Critical Gap", color: "#F87171" },
};

interface SimulationModalProps {
  geoid: string;
  tractName?: string;
  onClose: () => void;
}

interface SimResult {
  before?: { food_equity_score?: number; equity_tier?: string; grocery?: number; grocery_pct?: number; public_biz_per_1k?: number };
  after?: { food_equity_score?: number; equity_tier?: string; grocery?: number; grocery_pct?: number; public_biz_per_1k?: number };
  impact?: { score_improvement?: number; tier_changed?: boolean; tier_before?: string; tier_after?: string };
  population?: number;
  policy_brief?: string;
  error?: string;
}

export default function SimulationModal({ geoid, tractName, onClose }: SimulationModalProps) {
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSim() {
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geoid, new_businesses: count }),
      }).then(r => r.json());
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    }
    setLoading(false);
  }

  const before = result?.before;
  const after = result?.after;
  const impact = result?.impact;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#0D1017", border: "1px solid var(--border)", borderRadius: 12,
        width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 25px 50px rgba(0,0,0,0.7)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
              What-If Intervention
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-jetbrains), monospace", marginTop: 2 }}>
              Tract {geoid?.slice(-6)} {tractName ? `· ${tractName}` : ""}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer", padding: "2px 6px" }}>✕</button>
        </div>

        <div style={{ padding: 16 }}>
          {/* Controls */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>
              Simulate adding <b style={{ color: "var(--accent)" }}>grocery stores</b> to this census tract
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-jetbrains), monospace", textTransform: "uppercase", marginBottom: 4 }}>
                  New Grocery Stores
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {[1, 2, 3, 5].map(n => (
                    <button key={n} onClick={() => setCount(n)} style={{
                      flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 700,
                      background: count === n ? "var(--accent-dim)" : "var(--bg-base)",
                      border: `1px solid ${count === n ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 6, color: count === n ? "var(--accent)" : "var(--text-muted)",
                      cursor: "pointer",
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <button onClick={runSim} disabled={loading} className="btn-accent" style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                {loading ? "Simulating..." : "Run Sim"}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ color: "var(--red)", fontSize: 12, background: "var(--red-dim)", border: "1px solid rgba(240,112,112,0.2)", borderRadius: 7, padding: "8px 10px", marginBottom: 12 }}>
              {error}
            </div>
          )}

          {result && (
            <div>
              {/* Score comparison */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-jetbrains), monospace", textTransform: "uppercase", marginBottom: 8 }}>
                  Food Equity Score
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  {[
                    { label: "Before", val: before?.food_equity_score, tier: before?.equity_tier },
                    { label: "After", val: after?.food_equity_score, tier: after?.equity_tier },
                  ].map(({ label, val, tier }) => {
                    const tc = TIER_LABEL[tier || ""] || { label: tier || "", color: "var(--text-muted)" };
                    return (
                      <div key={label} style={{ flex: 1, textAlign: "center", background: "var(--bg-base)", borderRadius: 8, padding: "10px 4px", border: `1px solid ${tc.color}25` }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-jetbrains), monospace", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: tc.color, fontFamily: "var(--font-jetbrains), monospace", lineHeight: 1 }}>{val}</div>
                        <div style={{ fontSize: 10, color: tc.color, marginTop: 4 }}>{tc.label}</div>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 20, color: (impact?.score_improvement ?? 0) >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700, fontFamily: "var(--font-jetbrains), monospace", flexShrink: 0 }}>
                    +{impact?.score_improvement}
                  </div>
                </div>
                {impact?.tier_changed && (
                  <div style={{ background: "var(--accent-dim)", border: "1px solid rgba(118,185,0,0.2)", borderRadius: 6, padding: "6px 8px", fontSize: 11, color: "var(--accent)", textAlign: "center" }}>
                    Tier upgraded: {TIER_LABEL[impact.tier_before || ""]?.label} → {TIER_LABEL[impact.tier_after || ""]?.label}
                  </div>
                )}
              </div>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                {[
                  { label: "Grocery Stores", bef: String(before?.grocery), aft: String(after?.grocery), color: "var(--green)" },
                  { label: "Grocery Share", bef: `${before?.grocery_pct}%`, aft: `${after?.grocery_pct}%`, color: "var(--green)" },
                  { label: "Biz/1k Pop", bef: String(before?.public_biz_per_1k), aft: after?.public_biz_per_1k?.toFixed(2) || "", color: "var(--blue)" },
                  { label: "Population", bef: null, aft: result.population?.toLocaleString() || "", color: "var(--text-secondary)" },
                ].map(({ label, bef, aft, color }) => (
                  <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
                    {bef != null && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-jetbrains), monospace", marginBottom: 2 }}>{bef} →</div>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: "var(--font-jetbrains), monospace" }}>{aft}</div>
                  </div>
                ))}
              </div>

              {/* Policy brief */}
              {result.policy_brief && (
                <div style={{ background: "rgba(24,24,48,0.8)", border: "1px solid rgba(91,156,246,0.3)", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 10, color: "var(--blue)", fontFamily: "var(--font-jetbrains), monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    AI Policy Brief · Nemotron / DGX Spark
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {result.policy_brief}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
