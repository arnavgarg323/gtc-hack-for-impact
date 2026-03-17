'use client';
import { useState } from 'react';

const tierColor = { green: '#4ADE80', yellow: '#FBBF24', red: '#F87171' };
const CITIES = ['San Jose','Santa Clara','Sunnyvale','Mountain View','Palo Alto','Milpitas','Cupertino','Campbell','Los Gatos','Morgan Hill','Gilroy'];

export default function SearchTab({ onPan }) {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [tier, setTier] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  async function doSearch() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (city) params.set('city', city);
    if (tier) params.set('tier', tier);
    const data = await fetch('/api/proxy/search?' + params).then(r => r.json()).catch(() => []);
    setResults(data);
    setLoading(false);
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
      <div style={{ marginBottom: 10 }}>
        <input type="text" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Restaurant name..." style={{ width: '100%', marginBottom: 6 }} />
        <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
          <select value={city} onChange={e => setCity(e.target.value)} style={{ flex: 1 }}>
            <option value="">All cities</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={tier} onChange={e => setTier(e.target.value)} style={{ flex: 1 }}>
            <option value="">All scores</option>
            <option value="green">90+ Safe</option>
            <option value="yellow">75–89 Fair</option>
            <option value="red">&lt;75 Poor</option>
          </select>
        </div>
        <button onClick={doSearch} disabled={loading} style={{
          width: '100%', background: '#16532D', border: 'none', borderRadius: 7,
          padding: '8px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>
      <div className="stagger">
        {results.length === 0 && !loading && (
          <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: '20px 0' }}>
            Enter a name or select filters above
          </div>
        )}
        {results.map(r => (
          <div key={r.id} onClick={() => onPan?.(r)} style={{
            background: '#111520', border: '1px solid #1E2537', borderRadius: 8,
            padding: '8px 10px', cursor: 'pointer', marginBottom: 5,
            display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#4ADE80'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#1E2537'}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
              <div style={{ fontSize: 10, color: '#475569' }}>{r.city} · Score: {r.score || 'N/A'}</div>
            </div>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: tierColor[r.tier] || '#475569', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
