"use client";

import { useState, useEffect } from "react";

interface BenchmarkData {
  cpu_rf_elapsed_sec?: number;
  gpu_speedup?: number;
  gpu_speedup_estimated?: number;
  gpu_available?: boolean;
  [key: string]: unknown;
}

interface ClusterData {
  cluster_count?: number;
  elapsed_sec?: number;
  gpu?: boolean;
  [key: string]: unknown;
}

export default function GpuTab() {
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const [clusters, setClusters] = useState<ClusterData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/gpu-benchmark").then((r) => r.json()).catch(() => null),
      fetch("/api/gpu-clusters").then((r) => r.json()).catch(() => null),
    ]).then(([benchData, clusterData]) => {
      setBenchmark(benchData);
      setClusters(clusterData);
      setLoading(false);
    });
  }, []);

  const speedup = benchmark?.gpu_speedup ?? benchmark?.gpu_speedup_estimated;

  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "12px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>GPU Acceleration</div>
          <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "2px" }}>
            NVIDIA DGX Spark · Benchmark Results
          </div>
        </div>
      </div>

      {/* GPU Badge */}
      <div style={{ background: "linear-gradient(135deg, rgba(118,185,0,0.1), rgba(91,156,246,0.05))", border: "1px solid rgba(118,185,0,0.2)", borderRadius: "8px", padding: "14px" }}>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "18px", fontWeight: 700, color: "var(--accent)", marginBottom: "4px" }}>
          GB10 Superchip
        </div>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "11px", color: "var(--text-secondary)" }}>
          Nemotron-Nano-8B-Instruct · cuOpt routing
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: "55px" }} />)}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* Benchmark Results */}
          {benchmark && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                Benchmark Results
              </div>
              {benchmark.cpu_rf_elapsed_sec != null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>CPU RF elapsed</span>
                  <span style={{ fontFamily: "var(--font-jetbrains), monospace", color: "var(--yellow)", fontWeight: 600 }}>
                    {Number(benchmark.cpu_rf_elapsed_sec).toFixed(2)}s
                  </span>
                </div>
              )}
              {speedup != null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>
                    GPU Speedup{benchmark.gpu_speedup_estimated != null && !benchmark.gpu_speedup ? " (est.)" : ""}
                  </span>
                  <span style={{ fontFamily: "var(--font-jetbrains), monospace", color: "var(--accent)", fontWeight: 700, fontSize: "13px" }}>
                    {Number(speedup).toFixed(1)}x
                  </span>
                </div>
              )}
              {benchmark.gpu_available != null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>GPU Available</span>
                  <span style={{ fontFamily: "var(--font-jetbrains), monospace", color: benchmark.gpu_available ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    {benchmark.gpu_available ? "YES" : "NO"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Cluster Analysis */}
          {clusters && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                Cluster Analysis
              </div>
              {clusters.cluster_count != null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Clusters</span>
                  <span style={{ fontFamily: "var(--font-jetbrains), monospace", color: "var(--blue)", fontWeight: 700, fontSize: "13px" }}>
                    {clusters.cluster_count}
                  </span>
                </div>
              )}
              {clusters.elapsed_sec != null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Elapsed</span>
                  <span style={{ fontFamily: "var(--font-jetbrains), monospace", color: "var(--yellow)" }}>
                    {Number(clusters.elapsed_sec).toFixed(2)}s
                  </span>
                </div>
              )}
              {clusters.gpu != null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>GPU Accelerated</span>
                  <span style={{ fontFamily: "var(--font-jetbrains), monospace", color: clusters.gpu ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    {clusters.gpu ? "YES" : "NO"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Static DGX Spark specs */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
            <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
              DGX Spark Specs
            </div>
            {[
              { label: "Architecture", value: "GB10 Superchip", color: "var(--accent)" },
              { label: "AI Model", value: "Nemotron-Nano-8B", color: "var(--blue)" },
              { label: "Route Optimizer", value: "NVIDIA cuOpt", color: "var(--purple)" },
              { label: "Vector Store", value: "FAISS + pgvector", color: "var(--green)" },
              { label: "Framework", value: "vLLM + FastAPI", color: "var(--yellow)" },
            ].map((s) => <StatCard key={s.label} label={s.label} value={s.value} color={s.color} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--bg-base)", borderRadius: "6px", padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
      <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "12px", fontWeight: 600, color }}>{value}</span>
    </div>
  );
}
