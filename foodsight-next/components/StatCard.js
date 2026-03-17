'use client';
import { useEffect, useRef } from 'react';

export function StatCard({ label, value, color = '#4ADE80', sub }) {
  const numRef = useRef(null);

  useEffect(() => {
    if (!numRef.current || !value) return;
    const target = typeof value === 'number' ? value : parseInt(value) || 0;
    if (target === 0) return;
    let start = 0;
    const duration = 800;
    const startTime = performance.now();
    const tick = (now) => {
      const pct = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - pct, 3);
      const current = Math.round(ease * target);
      if (numRef.current) numRef.current.textContent = current.toLocaleString();
      if (pct < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  return (
    <div className="rounded-lg p-3" style={{
      background: '#111520', border: '1px solid #1E2537',
    }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569', fontFamily: 'JetBrains Mono, monospace', marginBottom: 4 }}>
        {label}
      </div>
      <div ref={numRef} style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
        {typeof value === 'number' ? '0' : value}
      </div>
      {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export function MiniBar({ label, value, max, color = '#4ADE80' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: '#CBD5E1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
        <span style={{ color: '#94A3B8', flexShrink: 0, marginLeft: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
      </div>
      <div style={{ height: 3, background: '#1E2537', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}
