'use client';
import { useEffect, useState } from 'react';

function CompBar({ label1, val1, label2, val2, unit, color1, color2 }) {
  const n1 = parseFloat(val1) || 0, n2 = parseFloat(val2) || 0;
  const max = Math.max(n1, n2) || 1;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: color1 }}>{label1}: <b>{val1}{unit}</b></span>
        <span style={{ color: color2 }}>{label2}: <b>{val2}{unit}</b></span>
      </div>
      <div style={{ display: 'flex', gap: 2, height: 6 }}>
        <div style={{ flex: n1 / max, background: color1, borderRadius: '3px 0 0 3px' }} />
        <div style={{ flex: n2 / max, background: color2, borderRadius: '0 3px 3px 0' }} />
      </div>
    </div>
  );
}

export default function EquityTab() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/proxy/equity-analysis').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>Loading…</div>;

  const { income_analysis: inc, hispanic_analysis: hisp, asian_analysis: asian, food_desert_demographics: fd } = data;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }} className="stagger">
      {[
        { title: 'Income & Food Access', sub: `County median: $${data.county_median_income?.toLocaleString()}`,
          content: <>
            <CompBar label1="Below median" val1={inc.below_median.avg_food_biz} label2="Above median" val2={inc.above_median.avg_food_biz} unit=" avg biz" color1="#F87171" color2="#4ADE80" />
            <CompBar label1="Below median" val1={inc.below_median.avg_biz_per_1k} label2="Above median" val2={inc.above_median.avg_biz_per_1k} unit="/1k pop" color1="#F87171" color2="#4ADE80" />
          </> },
        { title: 'Hispanic Community Access', sub: `${hisp.high_pct_30plus.tracts} tracts 30%+ Hispanic`,
          content: <>
            <CompBar label1="30%+ Hispanic" val1={hisp.high_pct_30plus.avg_food_biz} label2="<10%" val2={hisp.low_pct_under10.avg_food_biz} unit=" avg biz" color1="#FB923C" color2="#60A5FA" />
            <div style={{ fontSize: 10, color: '#475569' }}>Income — 30%+: ${hisp.high_pct_30plus.avg_income?.toLocaleString()} | &lt;10%: ${hisp.low_pct_under10.avg_income?.toLocaleString()}</div>
          </> },
        { title: 'Asian Community Access', sub: `${asian.high_pct_30plus.tracts} tracts 30%+ Asian`,
          content: <>
            <CompBar label1="30%+ Asian" val1={asian.high_pct_30plus.avg_food_biz} label2="<10%" val2={asian.low_pct_under10.avg_food_biz} unit=" avg biz" color1="#C084FC" color2="#60A5FA" />
            <div style={{ fontSize: 10, color: '#475569' }}>Income — 30%+: ${asian.high_pct_30plus.avg_income?.toLocaleString()} | &lt;10%: ${asian.low_pct_under10.avg_income?.toLocaleString()}</div>
          </> },
        { title: 'Food Desert Demographics',
          content: <>
            <div style={{ fontSize: 11, color: '#CBD5E1', marginBottom: 4 }}>{fd.desert_tracts} food desert tracts</div>
            <div style={{ fontSize: 11, color: '#CBD5E1' }}>Hispanic in deserts: <b style={{ color: '#F87171' }}>{fd.desert_avg_hispanic_pct}%</b> vs elsewhere: <b style={{ color: '#4ADE80' }}>{fd.non_desert_avg_hispanic_pct}%</b></div>
          </> },
      ].map(({ title, sub, content }) => (
        <div key={title} style={{ background: '#111520', border: '1px solid #1E2537', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0', marginBottom: sub ? 4 : 8, fontFamily: 'Syne, sans-serif' }}>{title}</div>
          {sub && <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>{sub}</div>}
          {content}
        </div>
      ))}
      <div style={{ fontSize: 10, color: '#334155', fontStyle: 'italic', padding: '4px 0' }}>Sources: ACS 2024 Census · SCC DEH · Census TIGER</div>
    </div>
  );
}
