'use client';
import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  'Which food deserts in Santa Clara County have the worst equity gaps?',
  'Which restaurants in San Jose have the lowest safety scores?',
  'Which tracts have the highest pollution burden and food insecurity?',
  'How many food trucks operate in San Jose?',
  'What are the most common critical violations?',
  'Which tracts need urgent grocery store investment to close equity gaps?',
];

function Message({ role, text, sources }) {
  return (
    <div className="flex gap-3 animate-fade-up" style={{ marginBottom: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
        background: role === 'user' ? '#1E3A5F' : '#0f3d24',
        border: `1px solid ${role === 'user' ? '#2563EB40' : '#4ADE8030'}`,
      }}>
        {role === 'user' ? '👤' : '🔍'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {role === 'user' ? 'You' : 'FoodSight AI'}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.65, color: role === 'user' ? '#BAE6FD' : '#E2E8F0', whiteSpace: 'pre-wrap' }}>
          {text}
        </div>
        {sources && (
          <div style={{ display: 'inline-block', marginTop: 5, fontSize: 10, color: '#475569', background: '#0D1017', padding: '2px 8px', borderRadius: 10, border: '1px solid #1E2537' }}>
            📋 {sources} records
          </div>
        )}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex gap-3" style={{ marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0f3d24', border: '1px solid #4ADE8030', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, marginTop: 2 }}>🔍</div>
      <div>
        <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>FoodSight AI</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', paddingTop: 4 }}>
          {[0, 0.2, 0.4].map(d => (
            <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ADE80', animation: `bounce 1.2s ${d}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatTab() {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Welcome to FoodSight AI — food safety intelligence for Santa Clara County, powered on NVIDIA DGX Spark GB10.\n\n8,583 inspected restaurants · 408 census tracts · 16+ open datasets\n\n👥 Human Impact — food deserts, equity scoring, policy simulation, GPU-optimized inspector routes\n🌱 Environmental — CalEnviroScreen pollution burden, CDC PLACES health outcomes, OSM infrastructure\n🌮 Cultural Impact — 815 food trucks, 284 cottage food entrepreneurs, county cultural archive\n\nAsk me anything about food safety, or explore the tabs above.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const msgRef = useRef(null);

  useEffect(() => {
    if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(q) {
    const question = q || input.trim();
    if (!question || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: question }]);
    setLoading(true);
    try {
      const resp = await fetch('/api/proxy/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await resp.json();
      setMessages(m => [...m, { role: 'bot', text: data.answer, sources: data.sources }]);
    } catch {
      setMessages(m => [...m, { role: 'bot', text: 'Sorry, an error occurred. Is the Flask backend running?' }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div ref={msgRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px' }}>
        {messages.map((m, i) => <Message key={i} {...m} />)}
        {loading && <Typing />}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid #1E2537', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)} style={{
              fontSize: 11, padding: '3px 10px',
              background: '#111520', border: '1px solid #1E2537',
              borderRadius: 12, color: '#94A3B8', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.target.style.borderColor = '#4ADE80'; e.target.style.color = '#4ADE80'; }}
            onMouseLeave={e => { e.target.style.borderColor = '#1E2537'; e.target.style.color = '#94A3B8'; }}>
              {s.length > 30 ? s.slice(0, 30) + '…' : s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about any restaurant or food safety topic..."
            style={{ flex: 1 }} />
          <button onClick={() => send()} disabled={loading} style={{
            background: loading ? '#1E2537' : '#16532D',
            border: 'none', borderRadius: 7, padding: '8px 16px',
            color: loading ? '#475569' : '#fff', fontSize: 13, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
          }}>
            Ask
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }`}</style>
    </div>
  );
}
