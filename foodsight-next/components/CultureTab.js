'use client';
import { useEffect, useState } from 'react';
import { StatCard } from './StatCard';

const SECTIONS = [
  { id: 'trucks', label: '🚚 Food Trucks', color: '#FBBF24' },
  { id: 'cottage', label: '🏠 Cottage Food', color: '#4ADE80' },
  { id: 'archive', label: '📷 History', color: '#94A3B8' },
];

export default function CultureTab() {
  const [section, setSection] = useState('trucks');
  const [trucks, setTrucks] = useState(null);
  const [cottage, setCottage] = useState(null);
  const [archive, setArchive] = useState(null);

  useEffect(() => {
    if (section === 'trucks' && !trucks) {
      fetch('/api/proxy/food-trucks').then(r => r.json()).then(setTrucks).catch(() => {});
    }
    if (section === 'cottage' && !cottage) {
      fetch('/api/proxy/cottage-food').then(r => r.json()).then(setCottage).catch(() => {});
    }
    if (section === 'archive' && !archive) {
      fetch('/api/proxy/photographers').then(r => r.json()).then(setArchive).catch(() => {});
    }
  }, [section]);

  function CityBars({ byCity, color }) {
    const entries = Object.entries(byCity || {}).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const max = entries[0]?.[1] || 1;
    return entries.map(([city, cnt]) => (
      <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #161B28' }}>
        <div style={{ flex: 1, fontSize: 11, color: '#CBD5E1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {city || 'Unknown'}
        </div>
        <div style={{ width: 70, height: 4, background: '#1E2537', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(cnt / max) * 100}%`, background: color, borderRadius: 2 }} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color, width: 26, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
          {cnt}
        </div>
      </div>
    ));
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
      {/* Section switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            flex: 1, padding: '6px 4px', fontSize: 10, fontWeight: 600,
            background: section === s.id ? `rgba(${s.id === 'trucks' ? '251,191,36' : s.id === 'cottage' ? '74,222,128' : '148,163,184'},0.12)` : '#111520',
            border: `1px solid ${section === s.id ? s.color : '#1E2537'}`,
            borderRadius: 7, color: section === s.id ? s.color : '#475569',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {section === 'trucks' && (
        <div className="stagger">
          {trucks ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                <StatCard label="Permitted Trucks" value={trucks.total} color="#FBBF24" />
                <StatCard label="Cities Served" value={Object.keys(trucks.by_city || {}).length} color="#FB923C" />
              </div>
              <div style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', marginBottom: 6 }}>By City</div>
              <CityBars byCity={trucks.by_city} color="#FBBF24" />
              <div style={{ fontSize: 10, color: '#334155', marginTop: 8, fontStyle: 'italic' }}>Source: {trucks.source}</div>
            </>
          ) : <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 20 }}>Loading…</div>}
        </div>
      )}

      {section === 'cottage' && (
        <div className="stagger">
          {cottage ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                <StatCard label="Licensed Producers" value={cottage.total} color="#4ADE80" />
                <StatCard label="Cities" value={Object.keys(cottage.by_city || {}).length} color="#34D399" />
              </div>
              <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 7, padding: '8px 10px', marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#86EFAC', lineHeight: 1.6 }}>
                  Home-based food businesses selling direct — jams, baked goods, candies. Regulated under CA AB 1616 Cottage Food Law.
                </div>
              </div>
              <div style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', marginBottom: 6 }}>By City</div>
              <CityBars byCity={cottage.by_city} color="#4ADE80" />
              <div style={{ fontSize: 10, color: '#334155', marginTop: 8, fontStyle: 'italic' }}>Source: {cottage.source}</div>
            </>
          ) : <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 20 }}>Loading…</div>}
        </div>
      )}

      {section === 'archive' && (
        <div className="stagger">
          {archive ? (
            <>
              <div style={{ background: 'linear-gradient(135deg, #451a03 0%, #111520 100%)', border: '1px solid #92400e', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#FDE68A', fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 2 }}>County Photo Archive</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#FFFBEB', fontFamily: 'JetBrains Mono, monospace' }}>{archive.total_photos?.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#D97706' }}>historical photographs · SCC heritage</div>
              </div>
              <div style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', marginBottom: 6 }}>Subject Themes</div>
              {Object.entries(archive.themes || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => {
                const max = Math.max(...Object.values(archive.themes));
                return (
                  <div key={k} style={{ marginBottom: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color: '#CBD5E1' }}>{k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                      <span style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{v}</span>
                    </div>
                    <div style={{ height: 3, background: '#1E2537', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(v / max) * 100}%`, background: '#D97706', borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </>
          ) : <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 20 }}>Loading…</div>}
        </div>
      )}
    </div>
  );
}
