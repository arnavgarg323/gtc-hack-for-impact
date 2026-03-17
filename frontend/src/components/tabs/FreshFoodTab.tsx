"use client";

import { useState, useEffect } from "react";

interface FoodCitySummary {
  city?: string;
  fresh_food_stores?: number;
  fresh_pct?: number;
  limited_fresh_stores?: number;
  restaurants?: number;
  [key: string]: unknown;
}

interface PriorityTract {
  name?: string;
  access_vulnerability_score?: number;
  fresh_food_businesses?: number;
  fresh_food_per_1k?: number;
  [key: string]: unknown;
}

interface FreshFoodTabProps {
  onFlyTo?: (lat: number, lon: number) => void;
}

export default function FreshFoodTab({ onFlyTo: _onFlyTo }: FreshFoodTabProps) {
  const [cityData, setCityData] = useState<FoodCitySummary[]>([]);
  const [tractData, setTractData] = useState<PriorityTract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/food-category-summary").then((r) => r.json()).catch(() => []),
      fetch("/api/priority-tracts").then((r) => r.json()).catch(() => []),
    ]).then(([cities, tracts]) => {
      setCityData(Array.isArray(cities) ? cities : []);
      setTractData(Array.isArray(tracts) ? tracts : []);
      setLoading(false);
    });
  }, []);

  const totalFreshStores = cityData.reduce((sum, c) => sum + (c.fresh_food_stores ?? 0), 0) || 888;
  const priorityTractCount = tractData.length || 121;

  const topVulnerable = [...tractData]
    .sort((a, b) => (b.access_vulnerability_score ?? 0) - (a.access_vulnerability_score ?? 0))
    .slice(0, 10);

  const maxFresh = Math.max(...cityData.map((c) => c.fresh_food_stores ?? 0), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Fresh Food Access</div>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "2px" }}>
          City summaries · priority tracts · vulnerability
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: "50px" }} />)}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ background: "linear-gradient(135deg, rgba(92,200,138,0.1), rgba(118,185,0,0.05))", border: "1px solid rgba(92,200,138,0.2)", borderRadius: "8px", padding: "12px" }}>
                <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Fresh Stores</div>
                <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "22px", fontWeight: 700, color: "var(--green)" }}>{totalFreshStores.toLocaleString()}</div>
              </div>
              <div style={{ background: "linear-gradient(135deg, rgba(240,112,112,0.1), rgba(246,173,85,0.05))", border: "1px solid rgba(240,112,112,0.2)", borderRadius: "8px", padding: "12px" }}>
                <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Priority Tracts</div>
                <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "22px", fontWeight: 700, color: "var(--red)" }}>{priorityTractCount}</div>
              </div>
            </div>

            {/* Fresh Food Stores by City */}
            {cityData.length > 0 && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
                <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Fresh Food Stores by City
                </div>
                {cityData
                  .sort((a, b) => (b.fresh_food_stores ?? 0) - (a.fresh_food_stores ?? 0))
                  .map((city, i) => (
                    <div key={i} style={{ marginBottom: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                        <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                          {city.city || `City ${i + 1}`}
                        </span>
                        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                          <span style={{ fontFamily: "var(--font-jetbrains), monospace", color: "var(--green)", fontWeight: 600 }}>
                            {city.fresh_food_stores ?? 0}
                          </span>
                          {city.fresh_pct != null && (
                            <span style={{ fontFamily: "var(--font-jetbrains), monospace", color: "var(--text-muted)", fontSize: "10px" }}>
                              {Number(city.fresh_pct).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ height: "4px", background: "var(--bg-base)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${((city.fresh_food_stores ?? 0) / maxFresh) * 100}%`, background: "var(--green)", borderRadius: "2px" }} />
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Highest Vulnerability Tracts */}
            {topVulnerable.length > 0 && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
                <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Highest Vulnerability Tracts
                </div>
                {topVulnerable.map((tract, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < topVulnerable.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "11px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tract.name || `Tract ${i + 1}`}
                      </div>
                      {tract.fresh_food_per_1k != null && (
                        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)" }}>
                          {Number(tract.fresh_food_per_1k).toFixed(2)} stores/1k pop
                        </div>
                      )}
                    </div>
                    {tract.access_vulnerability_score != null && (
                      <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "13px", fontWeight: 700, color: "var(--red)", flexShrink: 0, marginLeft: "8px" }}>
                        {Number(tract.access_vulnerability_score).toFixed(1)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {cityData.length === 0 && tractData.length === 0 && (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                No fresh food data available. Connect to the Flask backend to see city summaries and priority tracts in Santa Clara County.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
