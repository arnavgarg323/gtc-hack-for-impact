'use client';
import { useEffect, useState } from 'react';

export default function CitiesTab() {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch('/api/proxy/by-city').then(r => r.json()).then(d => setData(d.filter(c => c.total >= 5))).catch(() => {});
  }, []);

  const max = data[0]?.avg_score || 100;
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }} className="stagger">
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', fontFamily: 'JetBrains Mono, monospace', padding: '4px 0 10px' }}>
        Avg Safety Score by City
      </div>
      {data.map(c => {
        const color = c.avg_score >= 90 ? '#4ADE80' : c.avg_score >= 75 ? '#FBBF24' : '#F87171';
        return (
          <div key={c.city} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderRadius: 5, transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#111520'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ fontSize: 12, flex: 1, color: '#CBD5E1' }}>
              {c.city} <span style={{ fontSize: 10, color: '#334155' }}>({c.total})</span>
            </div>
            <div style={{ width: 80, height: 5, background: '#1E2537', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${c.avg_score}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, width: 34, textAlign: 'right', color, fontFamily: 'JetBrains Mono, monospace' }}>
              {c.avg_score}
            </div>
          </div>
        );
      })}
    </div>
  );
}
