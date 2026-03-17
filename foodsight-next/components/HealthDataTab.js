'use client';
import { useState } from 'react';

const METRICS = [
  { id: 'food_insecurity_pct', label: 'Food Insecurity', color: '#F87171' },
  { id: 'diabetes_pct', label: 'Diabetes', color: '#FB923C' },
  { id: 'obesity_pct', label: 'Obesity', color: '#FBBF24' },
  { id: 'ces_score', label: 'Pollution Burden', color: '#F97316', isCES: true },
  { id: 'depression_pct', label: 'Depression', color: '#C084FC' },
  { id: 'lack_transport_pct', label: 'No Transport', color: '#60A5FA' },
];

export default function HealthDataTab({ onChoropleth }) {
  const [active, setActive] = useState(null);
  const [top5, setTop5] = useState([]);
  const [source, setSource] = useState('');

  async function showMetric(metric) {
    setActive(metric.id);
    const isCES = metric.isCES;
    const url = isCES ? '/api/proxy/calenviroscreen' : '/api/proxy/health-outcomes';
    const data = await fetch(url).then(r => r.json()).catch(() => []);
    const records = Array.isArray(data) ? data : (data.tracts || []);
    const sorted = records.filter(r => r[metric.id] != null).sort((a, b) => b[metric.id] - a[metric.id]);
    setTop5(sorted.slice(0, 5));
    setSource(isCES ? 'CalEnviroScreen 4.0' : 'CDC PLACES 2023');
    onChoropleth?.(records, metric.id, metric.color);
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', fontFamily: 'JetBrains Mono, monospace', padding: '4px 0 8px' }}>
        CDC PLACES 2023 · CalEnviroScreen 4.0
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 12 }}>
        {METRICS.map(m => (
          <button key={m.id} onClick={() => showMetric(m)} style={{
            background: active === m.id ? `rgba(${hexToRgb(m.color)},0.15)` : '#111520',
            border: `1px solid ${active === m.id ? m.color : '#1E2537'}`,
            borderRadius: 7, padding: '7px 8px', cursor: 'pointer',
            fontSize: 11, color: active === m.id ? m.color : '#94A3B8',
            textAlign: 'left', transition: 'all 0.15s',
          }}>
            {m.label}
          </button>
        ))}
      </div>

      {top5.length > 0 && (
        <div style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Top 5 Tracts · {source}
          </div>
          {top5.map(r => {
            const metricId = METRICS.find(m => m.id === active)?.id;
            const val = r[metricId];
            const m = METRICS.find(m => m.id === active);
            return (
              <div key={r.geoid} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1E2537', fontSize: 11 }}>
                <span style={{ color: '#64748B', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>…{r.geoid?.slice(-7)}</span>
                <span style={{ color: m?.color, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                  {val != null ? val.toFixed(1) + (active !== 'ces_score' ? '%' : '') : 'N/A'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!active && (
        <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: '20px 0' }}>
          Select a metric above to render choropleth on map
        </div>
      )}
    </div>
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
