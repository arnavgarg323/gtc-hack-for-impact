'use client';
import { useState } from 'react';

const CITIES = ['San Jose','Santa Clara','Sunnyvale','Mountain View','Palo Alto','Milpitas','Cupertino','Campbell','Los Gatos'];
const ROUTE_COLORS = ['#60A5FA','#4ADE80','#F87171','#FBBF24','#C084FC'];

export default function RoutesTab({ onRoutes }) {
  const [city, setCity] = useState('San Jose');
  const [inspectors, setInspectors] = useState(2);
  const [stops, setStops] = useState(15);
  const [priority, setPriority] = useState('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function optimize() {
    setLoading(true);
    const t0 = performance.now();
    try {
      const data = await fetch('/api/proxy/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, n_inspectors: inspectors, n_stops: stops, priority }),
      }).then(r => r.json());
      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      setResult({ ...data, elapsed });
      onRoutes?.(data.routes);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  const isCuopt = result?.engine?.includes('cuOpt');

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
      {/* Config */}
      <div style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 8, padding: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', marginBottom: 8 }}>
          Route Config
        </div>
        <select value={city} onChange={e => setCity(e.target.value)} style={{ width: '100%', marginBottom: 6 }}>
          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 3, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>Inspectors</div>
            <select value={inspectors} onChange={e => setInspectors(+e.target.value)} style={{ width: '100%' }}>
              {[1,2,3].map(n => <option key={n} value={n}>{n} inspector{n>1?'s':''}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 3, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>Stops</div>
            <select value={stops} onChange={e => setStops(+e.target.value)} style={{ width: '100%' }}>
              {[10,15,20,30].map(n => <option key={n} value={n}>{n} stops</option>)}
            </select>
          </div>
        </div>
        <select value={priority} onChange={e => setPriority(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
          <option value="all">Priority: Worst scores first</option>
          <option value="red">Priority: Red-tier only</option>
          <option value="critical">Priority: Most critical violations</option>
        </select>
        <button onClick={optimize} disabled={loading} style={{
          width: '100%', background: loading ? '#1E2537' : 'linear-gradient(135deg, #1a365d, #2b6cb0)',
          border: '1px solid #2b6cb0', borderRadius: 7, padding: 8,
          color: loading ? '#475569' : '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? '⚡ Optimizing on GPU…' : '⚡ Optimize Routes'}
        </button>
      </div>

      {result?.error && <div style={{ color: '#F87171', fontSize: 12, padding: 8 }}>{result.error}</div>}

      {result && !result.error && (
        <div className="stagger">
          {/* Engine badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7, marginBottom: 8, background: isCuopt ? 'rgba(96,165,250,0.1)' : 'rgba(71,85,105,0.2)', border: `1px solid ${isCuopt ? '#3b82f640' : '#1E2537'}` }}>
            <span style={{ fontSize: 12 }}>{isCuopt ? '⚡' : '🔄'}</span>
            <span style={{ fontSize: 11, color: isCuopt ? '#60A5FA' : '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>{result.engine}</span>
            <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>{result.elapsed}s</span>
          </div>

          {(result.routes || []).map((route, i) => {
            const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
            const nonDepot = route.stops.filter(s => !s.depot);
            return (
              <div key={i} style={{ background: '#111520', border: `1px solid ${color}25`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>Inspector {route.inspector}</span>
                  <span style={{ fontSize: 10, color: '#475569' }}>{nonDepot.length} stops · {route.total_miles} mi</span>
                </div>
                {route.stops.map((s, j) => s.depot ? (
                  <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #161B28' }}>
                    <div style={{ width: 18, fontSize: 10, color: '#334155', textAlign: 'center' }}>⬤</div>
                    <div style={{ fontSize: 11, color: '#334155' }}>{s.name}</div>
                  </div>
                ) : (
                  <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #161B28' }}>
                    <div style={{ width: 18, fontSize: 10, fontWeight: 700, color, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>{j}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{s.address || ''}{s.critical > 0 ? ` · ⚠ ${s.critical} crit` : ''}</div>
                    </div>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: { green: '#4ADE80', yellow: '#FBBF24', red: '#F87171' }[s.tier] || '#475569', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
