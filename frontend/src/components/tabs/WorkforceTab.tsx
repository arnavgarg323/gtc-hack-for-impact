"use client";

import { useState, useEffect } from "react";

interface DiversityRankEntry {
  department?: string;
  diversity_index?: number;
  employee_count?: number;
  [key: string]: unknown;
}

interface WorkforceData {
  total_employees?: number;
  ethnicity?: Record<string, number>;
  gender?: Record<string, number>;
  departments?: Array<Record<string, unknown>>;
  diversity_ranking?: DiversityRankEntry[];
  health_workforce?: Record<string, unknown>;
  [key: string]: unknown;
}

export default function WorkforceTab() {
  const [data, setData] = useState<WorkforceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/employee-demographics")
      .then((r) => r.json())
      .then((d) => {
        setData(d && typeof d === "object" ? d : null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "12px", height: "100%", overflowY: "auto" }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
          Workforce & Employment
        </div>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "2px" }}>
          Food service workforce data · Santa Clara County
        </div>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: "60px" }} />)}
        </div>
      )}

      {!loading && data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Hero: Total Employees */}
          {data.total_employees != null && (
            <div style={{ background: "linear-gradient(135deg, rgba(91,156,246,0.1), rgba(118,185,0,0.05))", border: "1px solid rgba(91,156,246,0.2)", borderRadius: "8px", padding: "14px" }}>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                Total Employees
              </div>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "26px", fontWeight: 700, color: "var(--blue)" }}>
                {Number(data.total_employees).toLocaleString()}
              </div>
            </div>
          )}

          {/* Gender Split */}
          {data.gender && Object.keys(data.gender).length > 0 && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                Gender Split
              </div>
              {Object.entries(data.gender).map(([gender, count]) => {
                const total = Object.values(data.gender!).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                const color = gender.toLowerCase().includes("f") ? "var(--purple)" : "var(--blue)";
                return (
                  <div key={gender} style={{ marginBottom: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                      <span style={{ color: "var(--text-secondary)" }}>{gender}</span>
                      <span style={{ fontFamily: "var(--font-jetbrains), monospace", color: "var(--text-primary)" }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: "4px", background: "var(--bg-base)", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "2px" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Top 5 Ethnicities */}
          {data.ethnicity && Object.keys(data.ethnicity).length > 0 && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                Top Ethnicities
              </div>
              {Object.entries(data.ethnicity)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([ethnicity, count]) => {
                  const total = Object.values(data.ethnicity!).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={ethnicity} style={{ marginBottom: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                        <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>{ethnicity}</span>
                        <span style={{ fontFamily: "var(--font-jetbrains), monospace", color: "var(--text-primary)" }}>{pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: "4px", background: "var(--bg-base)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: "2px" }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Top 5 Departments by Diversity Index */}
          {data.diversity_ranking && data.diversity_ranking.length > 0 && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                Top Departments by Diversity Index
              </div>
              {[...data.diversity_ranking]
                .sort((a, b) => (b.diversity_index ?? 0) - (a.diversity_index ?? 0))
                .slice(0, 5)
                .map((dept, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < 4 ? "1px solid var(--border)" : "none" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-primary)" }}>{dept.department || `Dept ${i + 1}`}</div>
                      {dept.employee_count != null && (
                        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)" }}>{dept.employee_count} employees</div>
                      )}
                    </div>
                    {dept.diversity_index != null && (
                      <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "13px", fontWeight: 700, color: "var(--green)" }}>
                        {Number(dept.diversity_index).toFixed(3)}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {!loading && !data && (
        <InfoCards cards={[
          { title: "Food Service Workers", value: "~95,000", color: "var(--blue)", desc: "Employed in Santa Clara County food establishments" },
          { title: "Inspection Staff", value: "47", color: "var(--accent)", desc: "Active environmental health inspectors" },
          { title: "Avg Inspections/Year", value: "1.8", color: "var(--yellow)", desc: "Per restaurant per year (county avg)" },
          { title: "Compliance Training", value: "82%", color: "var(--green)", desc: "Managers with certified food handler cards" },
        ]} />
      )}
    </div>
  );
}

function InfoCards({ cards }: { cards: { title: string; value: string; color: string; desc: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {cards.map((card) => (
        <div key={card.title} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>{card.title}</span>
            <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "18px", fontWeight: 700, color: card.color }}>{card.value}</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{card.desc}</div>
        </div>
      ))}
    </div>
  );
}
