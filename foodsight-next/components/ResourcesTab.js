'use client';
import { useEffect, useState } from 'react';

const RESOURCES = [
  { id: 'wic', label: '🛒 WIC Stores', color: '#4ADE80', endpoint: '/api/proxy/wic-vendors', key: 'vendors' },
  { id: 'senior', label: '🍽 Senior Dining', color: '#FB923C', endpoint: '/api/proxy/senior-dining', key: 'sites' },
  { id: 'schools', label: '🏫 Schools', color: '#60A5FA', endpoint: '/api/proxy/schools', key: 'schools' },
  { id: 'healthcare', label: '🏥 Healthcare', color: '#F87171', endpoint: '/api/proxy/healthcare', key: 'facilities' },
];

export default function ResourcesTab() {
  const [counts, setCounts] = useState({});
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    fetch('/api/proxy/food-resources').then(r => r.json()).then(d => {
      setCounts(d.counts || {});
    }).catch(() => {});
  }, []);

  async function loadResource(res) {
    if (active === res.id) { setActive(null); setItems([]); return; }
    setActive(res.id);
    const data = await fetch(res.endpoint).then(r => r.json()).catch(() => ({}));
    setItems(data[res.key] || []);
  }

  const activeRes = RESOURCES.find(r => r.id === active);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 12 }}>
        {RESOURCES.map(r => (
          <button key={r.id} onClick={() => loadResource(r)} style={{
            background: active === r.id ? `rgba(${hexToRgb(r.color)},0.15)` : '#111520',
            border: `1px solid ${active === r.id ? r.color : '#1E2537'}`,
            borderRadius: 7, padding: '8px', cursor: 'pointer',
            fontSize: 11, color: active === r.id ? r.color : '#94A3B8',
            textAlign: 'left', transition: 'all 0.15s',
          }}>
            <div>{r.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', marginTop: 2, color: active === r.id ? r.color : '#475569' }}>
              {counts.wic && r.id === 'wic' ? counts.wic : r.id === 'senior' ? counts.senior_dining : r.id === 'schools' ? counts.schools : counts.healthcare || '—'}
            </div>
          </button>
        ))}
      </div>

      {items.length > 0 && activeRes && (
        <div className="stagger">
          <div style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', marginBottom: 6 }}>
            {items.length} locations
          </div>
          {items.slice(0, 30).map((item, i) => (
            <div key={i} style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 6, padding: '7px 10px', marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: activeRes.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name || item.facname || 'Unknown'}
              </div>
              <div style={{ fontSize: 10, color: '#475569' }}>{item.address || ''} {item.city ? `· ${item.city}` : ''}</div>
            </div>
          ))}
        </div>
      )}

      {!active && (
        <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: '20px 0' }}>
          Select a resource category above
        </div>
      )}
    </div>
  );
}

function hexToRgb(hex) {
  return [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)).join(',');
}
