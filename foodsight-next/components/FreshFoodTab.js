'use client';
import { useEffect, useState } from 'react';

export default function FreshFoodTab() {
  const [cats, setCats] = useState([]);
  const [priority, setPriority] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/proxy/food-category-summary').then(r => r.json()),
      fetch('/api/proxy/priority-tracts').then(r => r.json()),
    ]).then(([c, p]) => { setCats(c); setPriority(p); }).catch(() => {});
  }, []);

  const maxFresh = Math.max(...cats.map(c => c.fresh_food_stores), 1);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }} className="stagger">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        {[{ label: 'Fresh Food Stores', val: 888, color: '#4ADE80' }, { label: 'Priority Tracts', val: 121, color: '#FB923C' }].map(({ label, val, color }) => (
          <div key={label} style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 7, padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace' }}>{val}</div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9, color: '#4ADE80', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Fresh Food Stores by City
      </div>
      {cats.slice(0, 15).map(c => (
        <div key={c.city} style={{ padding: '5px 0', borderBottom: '1px solid #161B28' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
            <span style={{ color: '#CBD5E1' }}>{c.city}</span>
            <span style={{ color: '#4ADE80', fontFamily: 'JetBrains Mono, monospace' }}>{c.fresh_food_stores}</span>
            <span style={{ color: '#475569' }}>{c.fresh_pct}%</span>
          </div>
          <div style={{ height: 3, background: '#1E2537', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(c.fresh_food_stores / maxFresh) * 100}%`, background: '#4ADE80', borderRadius: 2 }} />
          </div>
        </div>
      ))}

      <div style={{ fontSize: 9, color: '#FB923C', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '12px 0 6px' }}>
        Highest Vulnerability Tracts
      </div>
      {priority.slice(0, 10).map(t => {
        const score = ((t.access_vulnerability_score || 0) * 100).toFixed(0);
        return (
          <div key={t.geoid} style={{ padding: '5px 0', borderBottom: '1px solid #161B28' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#E2E8F0', flex: 1 }}>{t.name?.replace('Census Tract ', 'Tract ').split(';')[0]}</span>
              <span style={{ color: '#FB923C', marginLeft: 6, fontFamily: 'JetBrains Mono, monospace' }}>{score}</span>
            </div>
            <div style={{ height: 2, background: '#1E2537', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
              <div style={{ height: '100%', width: `${score}%`, background: 'linear-gradient(90deg, #FB923C, #EF4444)', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{t.fresh_food_businesses} fresh stores · {t.fresh_food_per_1k}/1k</div>
          </div>
        );
      })}
    </div>
  );
}
