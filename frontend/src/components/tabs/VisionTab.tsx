"use client";

import { useState, useEffect, useRef } from "react";

interface ScoreItem {
  category: string;
  confidence_pct: number;
  score: number;
  prompt: string;
}

interface VisionResult {
  risk_level: "low" | "medium" | "high";
  risk_summary: string;
  scores: ScoreItem[];
}

const LABELS: Record<string, string> = {
  temperature_control: "Temp Control",
  handwashing: "Handwashing",
  pest_infestation: "Pest Infestation",
  food_contamination: "Contamination",
  surface_cleanliness: "Surface Clean",
  food_storage: "Food Storage",
  equipment_sanitation: "Equipment",
  employee_hygiene: "Employee Hygiene",
  chemical_hazard: "Chemical Hazard",
  adequate_facilities: "Facilities",
  safe_food_preparation: "Safe Prep",
  clean_environment: "Clean Env",
};

const ICONS: Record<string, string> = {
  temperature_control: "🌡️",
  handwashing: "🧼",
  pest_infestation: "🐜",
  food_contamination: "☢️",
  surface_cleanliness: "🧹",
  food_storage: "📦",
  equipment_sanitation: "🪑",
  employee_hygiene: "🧤",
  chemical_hazard: "⚠️",
  adequate_facilities: "🚰",
  safe_food_preparation: "✅",
  clean_environment: "✅",
};

const SAFE_CATS = new Set(["safe_food_preparation", "clean_environment"]);

const RISK_COLOR = { low: "var(--green)", medium: "var(--yellow)", high: "var(--red)" };
const RISK_ICON = { low: "✅", medium: "⚠️", high: "🚨" };

export default function VisionTab() {
  const [clipReady, setClipReady] = useState<boolean | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/clip-status")
      .then((r) => r.json())
      .then((d) => setClipReady(d.ready === true))
      .catch(() => setClipReady(false));
  }, []);

  function handleFile(file: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageB64(e.target?.result as string);
      setResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function analyze() {
    if (!imageB64) return;
    setAnalyzing(true);
    setError(null);
    const t0 = performance.now();
    try {
      const resp = await fetch("/api/vision-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageB64 }),
      });
      const data = await resp.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data as VisionResult);
        setElapsed((performance.now() - t0) / 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAnalyzing(false);
    }
  }

  function clear() {
    setImageB64(null);
    setResult(null);
    setError(null);
    setElapsed(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const topConcerns = result?.scores
    .filter((s) => !SAFE_CATS.has(s.category))
    .slice(0, 3) ?? [];

  const riskColor = result ? RISK_COLOR[result.risk_level] : "var(--text-muted)";

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            👁 Vision AI
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
            CLIP ViT-B/32 · zero-shot food safety
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "9px",
            padding: "2px 8px",
            borderRadius: "8px",
            background:
              clipReady === null
                ? "rgba(113,128,150,0.1)"
                : clipReady
                ? "rgba(72,187,120,0.1)"
                : "rgba(252,129,129,0.1)",
            border: `1px solid ${
              clipReady === null
                ? "var(--border)"
                : clipReady
                ? "rgba(72,187,120,0.3)"
                : "rgba(252,129,129,0.3)"
            }`,
            color:
              clipReady === null
                ? "var(--text-muted)"
                : clipReady
                ? "var(--green)"
                : "var(--red)",
            fontFamily: "var(--font-jetbrains), monospace",
          }}
        >
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background:
                clipReady === null ? "var(--text-muted)" : clipReady ? "var(--green)" : "var(--red)",
              display: "inline-block",
            }}
          />
          {clipReady === null ? "Checking..." : clipReady ? "CLIP ready" : "Unavailable"}
        </div>
      </div>

      {/* Drop zone */}
      {!imageB64 && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: "2px dashed var(--border)",
            borderRadius: "10px",
            padding: "24px 16px",
            textAlign: "center",
            cursor: "pointer",
            background: "rgba(45,49,72,0.1)",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--blue)";
            (e.currentTarget as HTMLDivElement).style.background = "rgba(100,181,246,0.04)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLDivElement).style.background = "rgba(45,49,72,0.1)";
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "6px" }}>📷</div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
            Drop photo or click to upload
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
            JPG/PNG — kitchen, restaurant, food storage
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Preview + analyze */}
      {imageB64 && !result && (
        <div>
          <img
            src={imageB64}
            alt="Preview"
            style={{
              width: "100%",
              maxHeight: "160px",
              objectFit: "cover",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              display: "block",
              marginBottom: "8px",
            }}
          />
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={analyze}
              disabled={analyzing}
              style={{
                flex: 1,
                padding: "8px",
                background: analyzing ? "var(--bg-card)" : "var(--accent-dim)",
                border: `1px solid ${analyzing ? "var(--border)" : "var(--accent)"}`,
                borderRadius: "6px",
                color: analyzing ? "var(--text-muted)" : "var(--accent)",
                fontSize: "11px",
                fontWeight: 600,
                cursor: analyzing ? "wait" : "pointer",
                fontFamily: "var(--font-jetbrains), monospace",
              }}
            >
              {analyzing ? "⏳ Analyzing..." : "⚡ Analyze with CLIP"}
            </button>
            <button
              onClick={clear}
              style={{
                padding: "8px 12px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                color: "var(--text-muted)",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "rgba(252,129,129,0.08)",
            border: "1px solid rgba(252,129,129,0.2)",
            borderRadius: "6px",
            padding: "10px",
            fontSize: "11px",
            color: "var(--red)",
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Thumbnail + clear */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <img
              src={imageB64!}
              alt="Analyzed"
              style={{
                width: "52px",
                height: "52px",
                objectFit: "cover",
                borderRadius: "6px",
                border: `1px solid ${riskColor}55`,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  color: riskColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                {RISK_ICON[result.risk_level]} {result.risk_level} Risk
              </div>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: "9px",
                  color: "var(--text-muted)",
                  marginTop: "2px",
                }}
              >
                {elapsed?.toFixed(2)}s · CLIP ViT-B/32 · {result.scores.length} checks
              </div>
            </div>
            <button
              onClick={clear}
              style={{
                padding: "4px 8px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "5px",
                color: "var(--text-muted)",
                fontSize: "10px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              New
            </button>
          </div>

          <div
            style={{
              background:
                result.risk_level === "high"
                  ? "rgba(252,129,129,0.06)"
                  : result.risk_level === "medium"
                  ? "rgba(236,201,75,0.06)"
                  : "rgba(72,187,120,0.06)",
              border: `1px solid ${riskColor}33`,
              borderRadius: "6px",
              padding: "8px 10px",
              fontSize: "11px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {result.risk_summary}
          </div>

          {/* Top concerns */}
          {topConcerns.length > 0 && (
            <>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: "9px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                }}
              >
                Top Signals
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {topConcerns.map((s) => {
                  const conf = s.confidence_pct;
                  const barColor =
                    conf > 65 ? "var(--red)" : conf > 52 ? "var(--yellow)" : "var(--blue)";
                  return (
                    <div
                      key={s.category}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        padding: "7px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span style={{ fontSize: "15px", flexShrink: 0 }}>
                        {ICONS[s.category] || "📋"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-primary)" }}>
                          {LABELS[s.category] || s.category}
                        </div>
                        <div
                          style={{
                            height: "3px",
                            background: "var(--bg-base)",
                            borderRadius: "2px",
                            overflow: "hidden",
                            marginTop: "3px",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${conf}%`,
                              background: barColor,
                              borderRadius: "2px",
                            }}
                          />
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: barColor,
                          fontFamily: "var(--font-jetbrains), monospace",
                          flexShrink: 0,
                        }}
                      >
                        {conf}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* All scores */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: "9px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                marginBottom: "8px",
              }}
            >
              Zero-Shot Similarity Scores
            </div>
            {result.scores.map((s) => {
              const isSafe = SAFE_CATS.has(s.category);
              const conf = s.confidence_pct;
              const maxConf = Math.max(...result.scores.map((x) => x.confidence_pct));
              const barColor = isSafe
                ? "var(--green)"
                : conf > 65
                ? "var(--red)"
                : conf > 52
                ? "var(--yellow)"
                : "var(--border)";
              const textColor = isSafe
                ? "var(--green)"
                : conf > 52
                ? "var(--text-secondary)"
                : "var(--text-muted)";
              return (
                <div
                  key={s.category}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "2px 0",
                  }}
                >
                  <div
                    style={{
                      width: "82px",
                      fontSize: "9px",
                      color: textColor,
                      textAlign: "right",
                      flexShrink: 0,
                      fontFamily: "var(--font-jetbrains), monospace",
                    }}
                  >
                    {LABELS[s.category] || s.category}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: "5px",
                      background: "var(--bg-base)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(conf / maxConf) * 100}%`,
                        background: barColor,
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: "32px",
                      fontSize: "9px",
                      color: textColor,
                      fontFamily: "var(--font-jetbrains), monospace",
                    }}
                  >
                    {conf}%
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
