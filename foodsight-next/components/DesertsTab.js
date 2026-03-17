'use client';
import { useEffect, useState } from 'react';
import { StatCard } from './StatCard';

function getCentroid(geometry) {
  if (!geometry) return null;
  try {
    const coords = geometry.type === 'Polygon'
      ? geometry.coordinates[0]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates[0][0]
        : null;
    if (!coords || !coords.length) return null;
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lon: lons.reduce((a, b) => a + b, 0) / lons.length,
    };
  } catch { return null; }
}

export default function DesertsTab({ onPan, onSimulate }) {
  const [summary, setSummary] = useState(null);
  const [tracts, setTracts] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/proxy/food-deserts').then(r => r.json()),
      fetch('/api/proxy/food-access-geojson').then(r => r.json()),
    ]).then(([s, gj]) => {
      setSummary(s);
      const deserts = gj.features
        .filter(f => f.properties.is_food_desert)
        .sort((a, b) => {
          if (a.properties.is_severe && !b.properties.is_severe) return -1;
          if (!a.properties.is_severe && b.properties.is_severe) return 1;
          return (a.properties.biz_per_1k_pop || 0) - (b.properties.biz_per_1k_pop || 0);
        });
      setTracts(deserts);
    }).catch(() => {});
  }, []);

  if (!summary) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>Loading…</div>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }} className="stagger">
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #2d1b4e 0%, #111520 100%)', border: '1px solid #4a3170', borderRadius: 8, padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#C084FC', fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 4 }}>Population in Food Deserts</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#E9D5FF', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
          {summary.food_desert_population?.toLocaleString()}
        </div>
        <div style={{ fontSize: 11, color: '#A78BFA', marginTop: 4 }}>
          {summary.food_desert_population_pct}% of Santa Clara County
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <StatCard label="Desert Tracts" value={summary.food_desert_tracts} color="#C084FC" />
        <StatCard label="Severe" value={summary.severe_food_desert_tracts} color="#F87171" />
        <StatCard label="Low Access" value={summary.low_access_tracts} color="#FB923C" />
        <StatCard label="Zero Biz" value={summary.zero_business_tracts} color="#FBBF24" />
      </div>

      <div style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Food Desert Tracts ({tracts.length})
      </div>
      {tracts.map(f => {
        const p = f.properties;
        const isSevere = p.is_severe;
        const centroid = getCentroid(f.geometry);
        return (
          <div key={p.geoid}
            style={{ background: '#111520', border: `1px solid ${isSevere ? '#7F1D1D' : '#1E2537'}`, borderLeft: `3px solid ${isSevere ? '#F87171' : '#7C3AED'}`, borderRadius: 7, padding: '8px 10px', marginBottom: 5, transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#C084FC'}
            onMouseLeave={e => e.currentTarget.style.borderColor = isSevere ? '#7F1D1D' : '#1E2537'}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, cursor: centroid ? 'pointer' : 'default' }}
                onClick={() => centroid && onPan?.(centroid)}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#E2E8F0' }}>
                  Tract {(p.geoid || '').slice(-6)} {isSevere ? <span style={{ color: '#F87171', fontSize: 9 }}>SEVERE</span> : ''}
                </div>
                <div style={{ fontSize: 10, color: '#475569' }}>
                  Income: ${(p.median_household_income || 0).toLocaleString()} · Poverty: {p.poverty_rate_pct || 0}%
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#C084FC', fontFamily: 'JetBrains Mono, monospace' }}>{p.food_biz_count || 0} biz</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>{(p.total_population || 0).toLocaleString()} pop</div>
                </div>
                {onSimulate && (
                  <button onClick={() => onSimulate(p.geoid)} style={{
                    padding: '3px 7px', fontSize: 9, fontWeight: 600,
                    background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
                    borderRadius: 4, color: '#4ADE80', cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    Simulate
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
