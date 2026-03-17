'use client';
import { useEffect, useState } from 'react';

const CLASS_COLOR = { 'Class I': '#F87171', 'Class II': '#FBBF24', 'Class III': '#4ADE80' };

export default function RecallsTab() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/proxy/food-recalls').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  const recalls = data?.recalls || [];
  const filtered = filter ? recalls.filter(r => r.classification?.includes(filter)) : recalls;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
      {/* Filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {['', 'Class I', 'Class II', 'Class III'].map(c => (
          <button key={c || 'all'} onClick={() => setFilter(c)} style={{
            flex: 1, padding: '5px 3px', fontSize: 10, fontWeight: 600,
            background: filter === c ? `rgba(${c === 'Class I' ? '248,113,113' : c === 'Class II' ? '251,191,36' : c === 'Class III' ? '74,222,128' : '100,116,139'},0.12)` : '#111520',
            border: `1px solid ${filter === c ? (CLASS_COLOR[c] || '#64748B') : '#1E2537'}`,
            borderRadius: 6, color: filter === c ? (CLASS_COLOR[c] || '#94A3B8') : '#475569',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {c || 'All'}
          </button>
        ))}
      </div>

      {!data && (
        <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 20 }}>Loading recalls…</div>
      )}

      {data && (
        <>
          <div style={{ fontSize: 10, color: '#475569', fontFamily: 'JetBrains Mono, monospace', marginBottom: 8 }}>
            {filtered.length} recalls · {data.source}
          </div>

          {/* Class I warning */}
          {filter === 'Class I' && (
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 7, padding: '8px 10px', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#FCA5A5', fontWeight: 600, marginBottom: 2 }}>⚠ Class I Recalls</div>
              <div style={{ fontSize: 11, color: '#FCA5A5', opacity: 0.8 }}>Dangerous or potentially fatal — highest priority.</div>
            </div>
          )}

          {filtered.slice(0, 50).map((r, i) => {
            const clsColor = CLASS_COLOR[r.classification] || '#475569';
            return (
              <div key={i} style={{ background: '#111520', border: '1px solid #1E2537', borderLeft: `3px solid ${clsColor}`, borderRadius: 7, padding: '8px 10px', marginBottom: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
                  <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#E2E8F0', lineHeight: 1.4 }}>
                    {r.product || 'Unknown product'}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: clsColor, flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                    {r.classification}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#60A5FA', marginBottom: 2 }}>{r.firm}</div>
                {r.reason && (
                  <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>
                    {r.reason.slice(0, 120)}{r.reason.length > 120 ? '…' : ''}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {r.date && (
                    <div style={{ fontSize: 9, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>{r.date}</div>
                  )}
                  {r.status && (
                    <div style={{ fontSize: 9, color: r.status === 'Ongoing' ? '#FBBF24' : '#475569' }}>{r.status}</div>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 20 }}>No recalls found.</div>
          )}
        </>
      )}
    </div>
  );
}
