'use client';
import { useEffect, useState } from 'react';

const TRACK_PILLS = [
  { label: '👥 Human Impact', bg: 'rgba(91,156,246,0.10)', border: 'rgba(91,156,246,0.25)', color: '#90c4ff' },
  { label: '🌱 Environmental', bg: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.25)', color: '#7de8a8' },
  { label: '🌮 Cultural', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.25)', color: '#fcd34d' },
];

export default function Header() {
  const [stats, setStats] = useState({ green: 0, yellow: 0, red: 0, total: 0 });

  useEffect(() => {
    fetch('/api/proxy/stats').then(r => r.json()).then(d => {
      setStats({
        green: d.green || 0,
        yellow: d.yellow || 0,
        red: d.red || 0,
        total: d.total_restaurants || 0,
      });
    }).catch(() => {});
  }, []);

  return (
    <header style={{
      position: 'relative', zIndex: 10,
      display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
      height: 52, flexShrink: 0,
      background: 'linear-gradient(to right, #0A0D16 0%, #0D1017 60%, #0A0D16 100%)',
      borderBottom: '1px solid #1E2537',
      boxShadow: '0 1px 0 rgba(74,222,128,0.06)',
    }}>

      {/* Logo + wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Icon */}
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, #0d3320 0%, #16532D 100%)',
            border: '1px solid rgba(74,222,128,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 3px rgba(74,222,128,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <path d="M11 8v6M8 11h6" strokeWidth="2.5"/>
            </svg>
          </div>
          <div className="glow-dot" style={{
            position: 'absolute', top: -2, right: -2,
            background: '#4ADE80', width: 8, height: 8,
          }} />
        </div>

        {/* Name */}
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, lineHeight: 1, letterSpacing: '-0.02em' }}>
            <span style={{ color: '#F1F5F9' }}>Food</span>
            <span style={{ color: '#4ADE80' }}>Sight</span>
            <span style={{ color: '#475569', fontSize: 11, fontWeight: 500, marginLeft: 5 }}>AI</span>
          </div>
          <div style={{ fontSize: 9, color: '#334155', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1, fontFamily: 'JetBrains Mono, monospace' }}>
            Santa Clara County
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: 'linear-gradient(to bottom, transparent, #1E2537, transparent)', margin: '0 2px' }} />

      {/* GPU Badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 10px', borderRadius: 8,
        background: 'rgba(74,222,128,0.06)',
        border: '1px solid rgba(74,222,128,0.18)',
        flexShrink: 0,
      }}>
        <div className="glow-dot" style={{ background: '#4ADE80' }} />
        <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#4ADE80', fontWeight: 600 }}>DGX Spark</span>
        <span style={{ fontSize: 10, color: '#334155' }}>·</span>
        <span style={{ fontSize: 10, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>Nemotron · cuOpt</span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: 'linear-gradient(to bottom, transparent, #1E2537, transparent)', margin: '0 2px' }} />

      {/* Hackathon track badges */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {TRACK_PILLS.map(({ label, bg, border, color }) => (
          <div key={label} style={{
            fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
            background: bg, border: `1px solid ${border}`, color,
            whiteSpace: 'nowrap', letterSpacing: '0.04em',
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Stats bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        {[
          { label: 'safe', val: stats.green, color: '#4ADE80' },
          { label: 'fair', val: stats.yellow, color: '#FBBF24' },
          { label: 'poor', val: stats.red, color: '#F87171' },
          { label: 'total', val: stats.total, color: '#475569' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color, fontWeight: 700, lineHeight: 1 }}>
              {val.toLocaleString()}
            </span>
            <span style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
          </div>
        ))}
      </div>
    </header>
  );
}
