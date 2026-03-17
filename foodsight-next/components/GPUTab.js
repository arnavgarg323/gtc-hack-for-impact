'use client';
import { useEffect, useState } from 'react';
import { StatCard } from './StatCard';

const CLUSTER_COLORS = ['#60A5FA', '#4ADE80', '#FBBF24', '#F87171', '#C084FC', '#FB923C'];

export default function GPUTab() {
  const [clusters, setClusters] = useState(null);
  const [benchmark, setBenchmark] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/proxy/gpu-clusters').then(r => r.json()).catch(() => null),
      fetch('/api/proxy/gpu-benchmark').then(r => r.json()).catch(() => null),
    ]).then(([c, b]) => { setClusters(c); setBenchmark(b); });
  }, []);

  const profiles = clusters?.profiles || [];
  const speedup = benchmark?.gpu_speedup || benchmark?.gpu_speedup_estimated;
  const isEst = !benchmark?.gpu_speedup && benchmark?.gpu_speedup_estimated;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }} className="stagger">
      {/* GPU Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0f2a1a 0%, #111520 100%)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#4ADE80', fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 2 }}>
              DGX Spark · GB10 Grace Blackwell
            </div>
            <div style={{ fontSize: 11, color: '#86EFAC' }}>{benchmark?.device || 'Accelerated Analysis'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#4ADE80', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
              {speedup ? `${speedup}×` : '—'}
            </div>
            <div style={{ fontSize: 10, color: '#475569' }}>{isEst ? 'est. speedup' : 'GPU speedup'}</div>
          </div>
        </div>
        {benchmark?.note && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#475569', fontStyle: 'italic', lineHeight: 1.4 }}>{benchmark.note}</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <StatCard label="CPU RF Time" value={benchmark?.cpu_rf_elapsed_sec != null ? `${benchmark.cpu_rf_elapsed_sec.toFixed(3)}s` : '—'} color="#94A3B8" />
        <StatCard label="Trees" value={benchmark?.n_estimators || '—'} color="#4ADE80" />
        <StatCard label="Tracts" value={benchmark?.n_tracts || '—'} color="#60A5FA" />
        <StatCard label="Clusters" value={profiles.length || '—'} color="#FBBF24" />
      </div>

      {/* Cluster method */}
      {clusters?.method && (
        <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 7, padding: '6px 10px', marginBottom: 10, fontSize: 10, color: '#93C5FD', fontFamily: 'JetBrains Mono, monospace' }}>
          Method: {clusters.method} · {clusters.elapsed_sec?.toFixed(2)}s
        </div>
      )}

      {/* Cluster profiles */}
      <div style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        cuML KMeans — Food Access Clusters
      </div>
      {profiles.map((p, i) => {
        const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
        return (
          <div key={i} style={{ background: '#111520', border: `1px solid ${color}30`, borderLeft: `3px solid ${color}`, borderRadius: 7, padding: 10, marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'Syne, sans-serif' }}>{p.label}</div>
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{p.n_tracts} tracts</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {[
                { k: 'Poverty', v: `${(p.avg_poverty_pct || 0).toFixed(1)}%`, c: '#F87171' },
                { k: 'Income', v: `$${Math.round(p.avg_income || 0).toLocaleString()}`, c: '#4ADE80' },
                { k: 'Biz/1k', v: `${(p.avg_biz_per_1k || 0).toFixed(2)}`, c: '#60A5FA' },
                { k: 'No Car', v: `${(p.avg_no_vehicle_pct || 0).toFixed(1)}%`, c: '#FBBF24' },
                { k: 'Hispanic', v: `${(p.avg_pct_hispanic || 0).toFixed(1)}%`, c: '#FB923C' },
                { k: 'Desert%', v: `${(p.food_desert_rate_pct || 0).toFixed(1)}%`, c: '#C084FC' },
              ].map(({ k, v, c }) => (
                <div key={k} style={{ textAlign: 'center', background: '#0D1017', borderRadius: 5, padding: '5px 2px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c, fontFamily: 'JetBrains Mono, monospace' }}>{v}</div>
                  <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>{k}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: '#475569' }}>
              {(p.total_pop || 0).toLocaleString()} residents · {(p.food_desert_rate_pct || 0).toFixed(1)}% food desert rate
            </div>
          </div>
        );
      })}

      {!profiles.length && (
        <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 20 }}>
          Run run_analysis.py to generate GPU cluster data.
        </div>
      )}

      <div style={{ fontSize: 10, color: '#334155', fontStyle: 'italic', padding: '4px 0' }}>
        cuML Random Forest · KMeans on NVIDIA DGX Spark GB10
      </div>
    </div>
  );
}
