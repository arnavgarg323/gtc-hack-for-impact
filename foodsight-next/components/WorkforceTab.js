'use client';
import { useEffect, useState } from 'react';

const ETH_COLORS = {
  'Asian': '#60A5FA',
  'Hispanic/Latino': '#FB923C',
  'White': '#94A3B8',
  'Black/African American': '#4ADE80',
  'Two or More Races': '#C084FC',
  'Not Specified': '#475569',
  'Native Hawaiian/Oth Pac Island': '#FBBF24',
  'American Indian/Alaska Native': '#F87171',
};

export default function WorkforceTab() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/proxy/employee-demographics').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>Loading…</div>
  );

  const ethEntries = Object.entries(data.ethnicity || {}).sort((a, b) => b[1] - a[1]);
  const maxEth = ethEntries[0]?.[1] || 1;
  const gF = data.gender?.Female || 0;
  const gM = data.gender?.Male || 0;
  const gTotal = gF + gM || 1;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }} className="stagger">
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #1a1a3e 0%, #111520 100%)', border: '1px solid #3b3b7a', borderRadius: 8, padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#93C5FD', fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 2 }}>
          County Workforce Demographics
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#E0E7FF', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
          {(data.total_employees || 0).toLocaleString()}
        </div>
        <div style={{ fontSize: 11, color: '#818CF8', marginTop: 4 }}>Santa Clara County employees</div>
      </div>

      {/* Gender */}
      <div style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 8, padding: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', marginBottom: 6 }}>Gender Distribution</div>
        <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ flex: gF, background: '#EC4899' }} />
          <div style={{ flex: gM, background: '#60A5FA' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#EC4899' }}>♀ Female <b>{((gF / gTotal) * 100).toFixed(1)}%</b> ({gF.toLocaleString()})</span>
          <span style={{ color: '#60A5FA' }}>♂ Male <b>{((gM / gTotal) * 100).toFixed(1)}%</b> ({gM.toLocaleString()})</span>
        </div>
      </div>

      {/* Age */}
      {data.age_distribution && (
        <div style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', marginBottom: 6 }}>Age Distribution</div>
          {Object.entries(data.age_distribution).sort((a, b) => b[1] - a[1]).map(([age, cnt]) => {
            const maxAge = Math.max(...Object.values(data.age_distribution));
            return (
              <div key={age} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 56, fontSize: 10, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>{age}</div>
                <div style={{ flex: 1, height: 4, background: '#1E2537', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(cnt / maxAge) * 100}%`, background: '#818CF8', borderRadius: 2 }} />
                </div>
                <div style={{ width: 40, textAlign: 'right', fontSize: 10, color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>{cnt.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ethnicity */}
      <div style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Ethnicity Breakdown
      </div>
      {ethEntries.map(([eth, cnt]) => {
        const color = ETH_COLORS[eth] || '#475569';
        const pct = ((cnt / data.total_employees) * 100).toFixed(1);
        return (
          <div key={eth} style={{ padding: '4px 0', borderBottom: '1px solid #161B28' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <div style={{ flex: 1, fontSize: 11, color: '#CBD5E1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eth}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace', width: 54, textAlign: 'right' }}>{cnt.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: '#475569', width: 36, textAlign: 'right' }}>{pct}%</div>
            </div>
            <div style={{ height: 3, background: '#1E2537', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(cnt / maxEth) * 100}%`, background: color, borderRadius: 2 }} />
            </div>
          </div>
        );
      })}

      {/* Top departments */}
      <div style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '12px 0 6px' }}>
        Top Departments
      </div>
      {(data.departments || []).slice(0, 8).map((dep, i) => (
        <div key={i} style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 6, padding: '7px 10px', marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, fontSize: 11, color: '#E2E8F0', lineHeight: 1.3, marginRight: 8 }}>{dep.department}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#60A5FA', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>{(dep.total || 0).toLocaleString()}</div>
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
            ♀ {(dep.gender?.Female || 0).toLocaleString()} · ♂ {(dep.gender?.Male || 0).toLocaleString()}
          </div>
        </div>
      ))}

      <div style={{ fontSize: 10, color: '#334155', fontStyle: 'italic', padding: '6px 0' }}>
        Source: SCC Open Data Portal · County Employee Demographics
      </div>
    </div>
  );
}
