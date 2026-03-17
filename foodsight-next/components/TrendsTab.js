'use client';
import { useEffect, useState } from 'react';
import { MiniBar } from './StatCard';

export default function TrendsTab() {
  const [months, setMonths] = useState([]);
  const [violations, setViolations] = useState([]);

  useEffect(() => {
    fetch('/api/proxy/trends').then(r => r.json()).then(d => setMonths((d.months || []).slice(-24))).catch(() => {});
    fetch('/api/proxy/violation-types').then(r => r.json()).then(d => setViolations(d.slice(0, 15))).catch(() => {});
  }, []);

  const maxV = violations[0]?.count || 1;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', fontFamily: 'JetBrains Mono, monospace', padding: '4px 0 8px' }}>
        Inspection Score Trend (24 months)
      </div>

      {/* Bar chart */}
      {months.length > 0 && (
        <div style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 8, padding: '10px 10px 6px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 80, paddingTop: 8 }}>
            {months.map((m, i) => {
              const h = Math.max(2, (m.avg_score / 100) * 70);
              const color = m.avg_score >= 90 ? '#4ADE80' : m.avg_score >= 75 ? '#FBBF24' : '#F87171';
              return (
                <div key={i} title={`${m.month}: ${m.avg_score} (${m.inspection_count || m.count || 0} inspections)`}
                  style={{ flex: 1, height: h, background: color, borderRadius: '2px 2px 0 0', minHeight: 2, cursor: 'help', opacity: 0.85, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.target.style.opacity = 1}
                  onMouseLeave={e => e.target.style.opacity = 0.85} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#475569', marginTop: 3, fontFamily: 'JetBrains Mono, monospace' }}>
            <span>{months[0]?.month}</span><span>{months[months.length - 1]?.month}</span>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', fontFamily: 'JetBrains Mono, monospace', padding: '4px 0 8px' }}>
        Top Violation Types
      </div>
      {violations.map(v => (
        <div key={v.type} style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
            <span style={{ color: '#CBD5E1', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.type}</span>
            <span style={{ color: '#64748B', flexShrink: 0, marginLeft: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
              {v.count.toLocaleString()}
              <span style={{ color: v.critical_pct > 50 ? '#F87171' : '#475569' }}> ({v.critical_pct}%)</span>
            </span>
          </div>
          <div style={{ height: 3, background: '#1E2537', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(v.count / maxV) * 100}%`, background: v.critical_pct > 50 ? '#F87171' : '#60A5FA', borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
