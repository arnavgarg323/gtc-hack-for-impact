"use client";

import { useState } from "react";
import type { Restaurant } from "@/types";

interface SearchTabProps {
  allMarkers?: Restaurant[];
  onPanTo?: (lat: number, lon: number) => void;
}

const TIERS = [
  { value: "", label: "All Tiers" },
  { value: "green", label: "Safe (90+)" },
  { value: "yellow", label: "Fair (70–89)" },
  { value: "red", label: "Poor (<70)" },
  { value: "unscored", label: "Unscored" },
];

export default function SearchTab({
  allMarkers = [],
  onPanTo,
}: SearchTabProps) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [tier, setTier] = useState("");
  const [results, setResults] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const cities = Array.from(
    new Set(allMarkers.map((m) => m.city).filter(Boolean))
  ).sort();

  async function doSearch() {
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (city) params.set("city", city);
    if (tier) params.set("tier", tier);

    try {
      const r = await fetch(`/api/search?${params.toString()}`);
      const d = await r.json();
      setResults(Array.isArray(d) ? d : d.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function getScoreDot(r: Restaurant) {
    const t = r.tier || (r.score != null ? (r.score >= 90 ? "green" : r.score >= 70 ? "yellow" : "red") : "unscored");
    const colors: Record<string, string> = {
      green: "var(--green)",
      yellow: "var(--yellow)",
      red: "var(--red)",
      unscored: "var(--text-muted)",
    };
    return colors[t] || "var(--text-muted)";
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
      {/* Search form */}
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
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
          Restaurant Search
        </div>
        <input
          placeholder="Search by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          style={{ fontSize: "13px" }}
        />
        <div style={{ display: "flex", gap: "6px" }}>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{ flex: 1, fontSize: "12px" }}
          >
            <option value="">All Cities</option>
            {cities.map((c) => (
              <option key={c} value={c as string}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            style={{ flex: 1, fontSize: "12px" }}
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={doSearch}
          className="btn-accent"
          style={{ width: "100%" }}
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Results */}
      <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
        {!searched && (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "12px",
            }}
          >
            Enter a restaurant name, select a city, or choose a tier to search.
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "12px",
            }}
          >
            No restaurants found. Try different search terms.
          </div>
        )}

        {results.map((r) => (
          <div
            key={r.id}
            onClick={() => {
              if (r.lat && r.lon && onPanTo) onPanTo(r.lat, r.lon);
            }}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "8px 10px",
              marginBottom: "4px",
              cursor: r.lat && r.lon ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-bright)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
            }}
          >
            {/* Score dot */}
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: getScoreDot(r),
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.name}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: "10px",
                  color: "var(--text-muted)",
                }}
              >
                {[r.city, r.address].filter(Boolean).join(" · ")}
              </div>
            </div>
            {r.score != null && (
              <span
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: getScoreDot(r),
                  flexShrink: 0,
                }}
              >
                {r.score}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Result count */}
      {searched && results.length > 0 && (
        <div
          style={{
            padding: "6px 12px",
            borderTop: "1px solid var(--border)",
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: "10px",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          {results.length} result{results.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
