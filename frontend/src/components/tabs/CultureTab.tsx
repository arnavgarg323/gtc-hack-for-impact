"use client";

import { useState, useEffect } from "react";

type Section = "archive" | "trucks" | "cottage";

interface ArchiveData {
  total_photos: number;
  color_breakdown: Record<string, number>;
  themes: Record<string, number>;
  departments: Record<string, number>;
  sample_subjects: string[];
}

interface TruckData {
  total: number;
  by_city: Record<string, number>;
  source: string;
}

export default function CultureTab() {
  const [section, setSection] = useState<Section>("trucks");
  const [archive, setArchive] = useState<ArchiveData | null>(null);
  const [trucks, setTrucks] = useState<TruckData | null>(null);
  const [cottage, setCottage] = useState<TruckData | null>(null);
  const [loadedArchive, setLoadedArchive] = useState(false);
  const [loadedTrucks, setLoadedTrucks] = useState(false);
  const [loadedCottage, setLoadedCottage] = useState(false);

  useEffect(() => {
    if (section === "archive" && !loadedArchive) {
      setLoadedArchive(true);
      fetch("/api/photographers")
        .then((r) => r.json())
        .then((d) => setArchive(d))
        .catch(() => {});
    }
    if (section === "trucks" && !loadedTrucks) {
      setLoadedTrucks(true);
      fetch("/api/food-trucks")
        .then((r) => r.json())
        .then((d) => setTrucks(d))
        .catch(() => {});
    }
    if (section === "cottage" && !loadedCottage) {
      setLoadedCottage(true);
      fetch("/api/cottage-food")
        .then((r) => r.json())
        .then((d) => setCottage(d))
        .catch(() => {});
    }
  }, [section, loadedArchive, loadedTrucks, loadedCottage]);

  const SECTIONS: { id: Section; label: string; color: string }[] = [
    { id: "trucks", label: "🚚 Food Trucks", color: "#f6ad55" },
    { id: "cottage", label: "🏠 Cottage Food", color: "var(--green)" },
    { id: "archive", label: "📷 History", color: "#ecc94b" },
  ];

  function renderCityBars(byCity: Record<string, number>, color: string) {
    const entries = Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const max = entries[0]?.[1] || 1;
    return entries.map(([city, cnt]) => (
      <div
        key={city}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "3px 0",
          borderBottom: "1px solid rgba(45,49,72,0.6)",
        }}
      >
        <div style={{ flex: 1, fontSize: "11px", color: "var(--text-primary)" }}>{city}</div>
        <div
          style={{
            width: "80px",
            height: "5px",
            background: "var(--bg-base)",
            borderRadius: "3px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(cnt / max) * 100}%`,
              background: color,
              borderRadius: "3px",
            }}
          />
        </div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color,
            width: "28px",
            textAlign: "right",
            fontFamily: "var(--font-jetbrains), monospace",
          }}
        >
          {cnt}
        </div>
      </div>
    ));
  }

  return (
    <div
      style={{
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        height: "100%",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
          Culture &amp; Entrepreneurship
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
          Living food culture · SCC DEH permitted vendors
        </div>
      </div>

      {/* Section switcher */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "5px" }}>
        {SECTIONS.map(({ id, label, color }) => {
          const active = section === id;
          return (
            <button
              key={id}
              onClick={() => setSection(id)}
              style={{
                fontSize: "9.5px",
                padding: "5px 4px",
                borderRadius: "6px",
                border: `1px solid ${active ? color : "var(--border)"}`,
                background: active ? `${color}18` : "transparent",
                color: active ? color : "var(--text-muted)",
                cursor: "pointer",
                fontFamily: "var(--font-jetbrains), monospace",
                textAlign: "center",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Food Trucks */}
      {section === "trucks" && (
        <>
          {!trucks && (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "24px" }} />
              ))}
            </div>
          )}
          {trucks && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div
                  style={{
                    background: "rgba(246,173,85,0.08)",
                    border: "1px solid rgba(246,173,85,0.2)",
                    borderRadius: "6px",
                    padding: "10px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 800,
                      color: "#f6ad55",
                      fontFamily: "var(--font-jetbrains), monospace",
                    }}
                  >
                    {trucks.total}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                    Permitted Food Trucks
                  </div>
                </div>
                <div
                  style={{
                    background: "rgba(246,173,85,0.08)",
                    border: "1px solid rgba(246,173,85,0.2)",
                    borderRadius: "6px",
                    padding: "10px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 800,
                      color: "#fbd38d",
                      fontFamily: "var(--font-jetbrains), monospace",
                    }}
                  >
                    {Object.keys(trucks.by_city).length}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Cities Covered</div>
                </div>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: "9px",
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  marginBottom: "2px",
                }}
              >
                Trucks by City
              </div>
              {renderCityBars(trucks.by_city, "#f6ad55")}
              <div
                style={{
                  fontSize: "9px",
                  color: "var(--text-muted)",
                  fontStyle: "italic",
                  fontFamily: "var(--font-jetbrains), monospace",
                }}
              >
                Source: {trucks.source}
              </div>
            </>
          )}
        </>
      )}

      {/* Cottage Food */}
      {section === "cottage" && (
        <>
          {!cottage && (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "24px" }} />
              ))}
            </div>
          )}
          {cottage && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div
                  style={{
                    background: "rgba(104,211,145,0.08)",
                    border: "1px solid rgba(104,211,145,0.2)",
                    borderRadius: "6px",
                    padding: "10px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 800,
                      color: "var(--green)",
                      fontFamily: "var(--font-jetbrains), monospace",
                    }}
                  >
                    {cottage.total}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                    Licensed Producers
                  </div>
                </div>
                <div
                  style={{
                    background: "rgba(104,211,145,0.08)",
                    border: "1px solid rgba(104,211,145,0.2)",
                    borderRadius: "6px",
                    padding: "10px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 800,
                      color: "#9ae6b4",
                      fontFamily: "var(--font-jetbrains), monospace",
                    }}
                  >
                    {Object.keys(cottage.by_city).length}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Cities</div>
                </div>
              </div>
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                Home-based food businesses selling direct — jams, baked goods, candies and more.
                Regulated under CA AB 1616 Cottage Food Law.
              </div>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: "9px",
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  marginBottom: "2px",
                }}
              >
                Producers by City
              </div>
              {renderCityBars(cottage.by_city, "var(--green)")}
              <div
                style={{
                  fontSize: "9px",
                  color: "var(--text-muted)",
                  fontStyle: "italic",
                  fontFamily: "var(--font-jetbrains), monospace",
                }}
              >
                Source: {cottage.source}
              </div>
            </>
          )}
        </>
      )}

      {/* Photo Archive */}
      {section === "archive" && (
        <>
          {!archive && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "32px" }} />
              ))}
            </div>
          )}
          {archive && (
            <>
              <div
                style={{
                  background: "linear-gradient(135deg,rgba(116,66,16,0.3) 0%,transparent 100%)",
                  border: "1px solid rgba(151,90,22,0.4)",
                  borderRadius: "8px",
                  padding: "12px",
                }}
              >
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#fbd38d" }}>
                  County Photo Archive
                </div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 800,
                    color: "#fefcbf",
                    fontFamily: "var(--font-jetbrains), monospace",
                    lineHeight: 1.1,
                    margin: "3px 0",
                  }}
                >
                  {archive.total_photos.toLocaleString()}
                </div>
                <div style={{ fontSize: "10px", color: "#f6e05e" }}>
                  historical photographs documenting SCC heritage
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                {Object.entries(archive.color_breakdown).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-jetbrains), monospace",
                      }}
                    >
                      {Number(v).toLocaleString()}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{k}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: "9px",
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                }}
              >
                Subject Themes
              </div>
              {Object.entries(archive.themes)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([theme, count]) => {
                  const max = Math.max(...Object.values(archive.themes));
                  const label = theme.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <div
                      key={theme}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "3px 0",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          width: "70px",
                          height: "4px",
                          background: "var(--bg-base)",
                          borderRadius: "2px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${(Number(count) / max) * 100}%`,
                            background: "#ecc94b",
                            borderRadius: "2px",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-jetbrains), monospace",
                          width: "28px",
                          textAlign: "right",
                        }}
                      >
                        {count}
                      </div>
                    </div>
                  );
                })}
              <div
                style={{
                  fontSize: "9px",
                  color: "var(--text-muted)",
                  fontStyle: "italic",
                  fontFamily: "var(--font-jetbrains), monospace",
                }}
              >
                Source: County Photographers&apos; Collection (4,541 records)
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
