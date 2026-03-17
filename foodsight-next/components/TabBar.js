'use client';

const TABS = [
  { id: 'chat',        label: 'Ask AI' },
  { id: 'deserts',     label: 'Food Deserts' },
  { id: 'violators',   label: 'Violators' },
  { id: 'cities',      label: 'By City' },
  { id: 'search',      label: 'Search' },
  { id: 'trends',      label: 'Trends' },
  { id: 'equity',      label: 'Equity' },
  { id: 'culture',     label: 'Culture' },
  { id: 'freshfood',   label: 'Fresh Food' },
  { id: 'healthdata',  label: 'Health' },
  { id: 'mlrisk',      label: 'ML Risk' },
  { id: 'routes',      label: 'Routes' },
  { id: 'resources',   label: 'Resources' },
  { id: 'workforce',   label: 'Workforce' },
  { id: 'gpu',         label: 'GPU' },
  { id: 'recalls',     label: 'Recalls' },
];

export default function TabBar({ active, onChange }) {
  return (
    <div className="flex overflow-x-auto border-b" style={{
      borderColor: '#1E2537',
      background: '#0A0C14',
      flexShrink: 0,
      scrollbarWidth: 'none',
    }}>
      {TABS.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          style={{
            flex: '0 0 auto',
            padding: '9px 10px',
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontFamily: 'JetBrains Mono, monospace',
            color: active === tab.id ? '#4ADE80' : '#475569',
            background: 'none',
            border: 'none',
            borderBottom: active === tab.id ? '2px solid #4ADE80' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'color 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { if (active !== tab.id) e.target.style.color = '#94A3B8'; }}
          onMouseLeave={e => { if (active !== tab.id) e.target.style.color = '#475569'; }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
