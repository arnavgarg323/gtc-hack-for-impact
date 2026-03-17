'use client';
import { useEffect, useState } from 'react';
import { StatCard } from './StatCard';

const TIER_COLOR = { critical: '#F87171', high: '#FB923C', moderate: '#FBBF24', low: '#4ADE80', minimal: '#60A5FA' };

export default function MLRiskTab() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/proxy/ml-risk').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>Loading…</div>;

  const stats = data.model_stats || {};
  const tracts = data.tracts || [];
  const tierCounts = {};
  tracts.forEach(t => { tierCounts[t.risk_tier] = (tierCounts[t.risk_tier] || 0) + 1; });
  const feats = (stats.feature_importances || []).slice(0, 8);
  const maxImp = feats[0]?.importance || 1;
  const gb = stats.binary_classifier || {};
  const rf = stats.multiclass_classifier || {};

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }} className="stagger">
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #44337a 0%, #111520 100%)', border: '1px solid #553c9a', borderRadius: 8, padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#D6BCFA', fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 2 }}>GPU-Accelerated ML Risk Model</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#E9D8FD', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{tierCounts.critical || 0}</div>
        <div style={{ fontSize: 11, color: '#B794F4', marginTop: 4 }}>critical-risk census tracts</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <StatCard label="ROC-AUC" value={gb.cv_roc_auc_mean || '—'} color="#C084FC" />
        <StatCard label="F1 Score" value={rf.cv_f1_weighted_mean || '—'} color="#C084FC" />
        <StatCard label="High Risk" value={tierCounts.high || 0} color="#FB923C" />
        <StatCard label="Minimal" value={tierCounts.minimal || 0} color="#60A5FA" />
      </div>

      <div style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 8, padding: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', marginBottom: 8 }}>Top Predictive Features</div>
        {feats.map(f => {
          const label = f.feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const pct = ((f.importance / maxImp) * 100).toFixed(0);
          return (
            <div key={f.feature} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: '#CBD5E1' }}>{label}</span>
                <span style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{(f.importance * 100).toFixed(1)}%</span>
              </div>
              <div style={{ height: 4, background: '#1E2537', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #7C3AED, #C084FC)', borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', marginBottom: 6 }}>Critical Risk Tracts</div>
      {tracts.filter(t => t.risk_tier === 'critical').slice(0, 15).map(t => (
        <div key={t.geoid} style={{ display: 'flex', alignItems: 'center', padding: '6px 4px', borderBottom: '1px solid #161B28' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#E2E8F0' }}>Tract {t.geoid?.slice(-6)}</div>
            <div style={{ fontSize: 10, color: '#475569' }}>{(t.total_population || 0).toLocaleString()} people · poverty: {t.poverty_rate_pct?.toFixed(1) || 'N/A'}%</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F87171', fontFamily: 'JetBrains Mono, monospace' }}>{t.risk_score}</div>
            <div style={{ fontSize: 9, color: '#F87171', textTransform: 'uppercase' }}>CRITICAL</div>
          </div>
        </div>
      ))}
    </div>
  );
}
