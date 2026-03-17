'use client';
import { useEffect, useState } from 'react';

const tierColor = { green: '#4ADE80', yellow: '#FBBF24', red: '#F87171', gray: '#475569' };

export default function ViolatorsTab({ onPan }) {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch('/api/proxy/worst-violators').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }} className="stagger">
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', fontFamily: 'JetBrains Mono, monospace', padding: '4px 0 10px' }}>
        Top 15 · Critical Violations
      </div>
      {data.map((r, i) => (
        <div key={r.id} onClick={() => onPan?.(r)} style={{
          background: '#111520', border: '1px solid #1E2537',
          borderRadius: 8, padding: '9px 11px',
          cursor: 'pointer', marginBottom: 5,
          display: 'flex', gap: 10, alignItems: 'center',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#F87171'}
        onMouseLeave={e => e.currentTarget.style.borderColor = '#1E2537'}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', width: 18, fontFamily: 'JetBrains Mono, monospace' }}>
            {i + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
            <div style={{ fontSize: 10, color: '#475569' }}>{r.city}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F87171', fontFamily: 'JetBrains Mono, monospace' }}>⚠ {r.critical}</div>
            <div style={{ fontSize: 10, color: '#475569' }}>Score: {r.score || 'N/A'}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
