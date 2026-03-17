'use client';
import { useState } from 'react';

const TIER_LABEL = {
  high_equity: { label: 'High Equity', color: '#4ADE80' },
  moderate_equity: { label: 'Moderate Equity', color: '#FBBF24' },
  low_equity: { label: 'Low Equity', color: '#FB923C' },
  critical_equity_gap: { label: 'Critical Gap', color: '#F87171' },
};

export default function SimulationModal({ geoid, tractName, onClose }) {
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runSim() {
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await fetch('/api/proxy/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geoid, new_businesses: count }),
      }).then(r => r.json());
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  const before = result?.before;
  const after = result?.after;
  const impact = result?.impact;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#0D1017', border: '1px solid #1E2537', borderRadius: 12,
        width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #1E2537' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0', fontFamily: 'Syne, sans-serif' }}>
              What-If Intervention
            </div>
            <div style={{ fontSize: 11, color: '#475569', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              Tract {geoid?.slice(-6)} {tractName ? `· ${tractName}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer', padding: '2px 6px' }}>✕</button>
        </div>

        <div style={{ padding: 16 }}>
          {/* Controls */}
          <div style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
              Simulate adding <b style={{ color: '#4ADE80' }}>grocery stores</b> to this census tract
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', marginBottom: 4 }}>
                  New Grocery Stores
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[1, 2, 3, 5].map(n => (
                    <button key={n} onClick={() => setCount(n)} style={{
                      flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 700,
                      background: count === n ? 'rgba(74,222,128,0.15)' : '#0D1017',
                      border: `1px solid ${count === n ? '#4ADE80' : '#1E2537'}`,
                      borderRadius: 6, color: count === n ? '#4ADE80' : '#475569',
                      cursor: 'pointer',
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <button onClick={runSim} disabled={loading} style={{
                background: loading ? '#1E2537' : 'linear-gradient(135deg, #1a4731, #166534)',
                border: '1px solid #166534', borderRadius: 8, padding: '10px 16px',
                color: loading ? '#475569' : '#fff', fontSize: 13, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}>
                {loading ? '⚡ Simulating…' : '⚡ Run Sim'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ color: '#F87171', fontSize: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 7, padding: '8px 10px', marginBottom: 12 }}>
              {error}
            </div>
          )}

          {result && (
            <div className="stagger">
              {/* Score comparison */}
              <div style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', marginBottom: 8 }}>
                  Food Equity Score
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  {[{ label: 'Before', val: before?.food_equity_score, tier: before?.equity_tier }, { label: 'After', val: after?.food_equity_score, tier: after?.equity_tier }].map(({ label, val, tier }) => {
                    const tc = TIER_LABEL[tier] || { label: tier, color: '#475569' };
                    return (
                      <div key={label} style={{ flex: 1, textAlign: 'center', background: '#0D1017', borderRadius: 8, padding: '10px 4px', border: `1px solid ${tc.color}25` }}>
                        <div style={{ fontSize: 10, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: tc.color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{val}</div>
                        <div style={{ fontSize: 10, color: tc.color, marginTop: 4 }}>{tc.label}</div>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 20, color: impact?.score_improvement >= 0 ? '#4ADE80' : '#F87171', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                    +{impact?.score_improvement}
                  </div>
                </div>
                {impact?.tier_changed && (
                  <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 6, padding: '6px 8px', fontSize: 11, color: '#86EFAC', textAlign: 'center' }}>
                    ✓ Tier upgraded: {TIER_LABEL[impact.tier_before]?.label} → {TIER_LABEL[impact.tier_after]?.label}
                  </div>
                )}
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                {[
                  { label: 'Grocery Stores', before: before?.grocery, after: after?.grocery, color: '#4ADE80' },
                  { label: 'Grocery Share', before: `${before?.grocery_pct}%`, after: `${after?.grocery_pct}%`, color: '#4ADE80' },
                  { label: 'Biz/1k Pop', before: before?.public_biz_per_1k, after: after?.public_biz_per_1k?.toFixed(2), color: '#60A5FA' },
                  { label: 'Population', before: null, after: result.population?.toLocaleString(), color: '#94A3B8' },
                ].map(({ label, before: b, after: a, color }) => (
                  <div key={label} style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>{label}</div>
                    {b != null && (
                      <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'JetBrains Mono, monospace', marginBottom: 2 }}>{b} →</div>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>{a}</div>
                  </div>
                ))}
              </div>

              {/* Policy brief */}
              {result.policy_brief && (
                <div style={{ background: 'rgba(24,24,48,0.8)', border: '1px solid #2d3a56', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 10, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    ✦ AI Policy Brief · Nemotron / DGX Spark
                  </div>
                  <div style={{ fontSize: 12, color: '#CBD5E1', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
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
