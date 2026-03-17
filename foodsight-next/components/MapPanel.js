'use client';
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '© OpenStreetMap © CartoDB';
const SCC_CENTER = [37.35, -121.9];
const tierColor = { green: '#4ADE80', yellow: '#FBBF24', red: '#F87171' };

const SCC_CITY_CENTROIDS = {
  'San Jose': [37.3382, -121.8863],
  'Santa Clara': [37.3541, -121.9552],
  'Sunnyvale': [37.3688, -122.0363],
  'Mountain View': [37.3861, -122.0839],
  'Palo Alto': [37.4419, -122.1430],
  'Milpitas': [37.4323, -121.8996],
  'Cupertino': [37.3230, -122.0322],
  'Campbell': [37.2872, -121.9500],
  'Los Gatos': [37.2358, -121.9625],
  'Saratoga': [37.2638, -122.0231],
  'Los Altos': [37.3852, -122.1141],
  'Morgan Hill': [37.1305, -121.6544],
  'Gilroy': [37.0058, -121.5683],
};

const LAYER_DEFS = [
  { id: 'restaurants', label: 'Restaurants', color: '#4ADE80', icon: '🍽' },
  { id: 'equity', label: 'Equity', color: '#60A5FA', icon: '⚖' },
  { id: 'deserts', label: 'Deserts', color: '#C084FC', icon: '🏜' },
  { id: 'mlrisk', label: 'ML Risk', color: '#F87171', icon: '🤖' },
  { id: 'freshfood', label: 'Fresh Food', color: '#86EFAC', icon: '🥦' },
  { id: 'trucks', label: 'Food Trucks', color: '#FBBF24', icon: '🚚' },
  { id: 'cottage', label: 'Cottage Food', color: '#34D399', icon: '🏠' },
  { id: 'crime', label: 'Crime', color: '#FB923C', icon: '⚠' },
];

function interpColor(t, fromRGB, toRGB) {
  const r = Math.round(fromRGB[0] + t * (toRGB[0] - fromRGB[0]));
  const g = Math.round(fromRGB[1] + t * (toRGB[1] - fromRGB[1]));
  const b = Math.round(fromRGB[2] + t * (toRGB[2] - fromRGB[2]));
  return `rgb(${r},${g},${b})`;
}

const MapPanel = forwardRef(function MapPanel({ onMapReady }, ref) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const layersRef = useRef({});
  const [ready, setReady] = useState(false);
  const [activeLayers, setActiveLayers] = useState({ restaurants: true });

  function toggleLayerUI(id) {
    setActiveLayers(prev => {
      const next = { ...prev, [id]: !prev[id] };
      handleLayerToggle(id, !prev[id]);
      return next;
    });
  }

  function handleLayerToggle(id, on) {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;

    if (!on) {
      if (layersRef.current[id]) {
        map.removeLayer(layersRef.current[id]);
        delete layersRef.current[id];
      }
      return;
    }

    switch (id) {
      case 'restaurants': loadRestaurants(map, L); break;
      case 'equity': loadEquityLayer(map, L); break;
      case 'deserts': loadDesertLayer(map, L); break;
      case 'mlrisk': loadMLRiskLayer(map, L); break;
      case 'freshfood': loadFreshFoodLayer(map, L); break;
      case 'trucks': loadFoodTrucksLayer(map, L); break;
      case 'cottage': loadCottageFoodLayer(map, L); break;
      case 'crime': loadCrimeLayer(map, L); break;
    }
  }

  function loadRestaurants(map, L) {
    if (layersRef.current.restaurants) return;
    fetch('/flask/api/restaurants').then(r => r.json()).then(restaurants => {
      const group = L.layerGroup();
      restaurants.forEach(r => {
        if (!r.latitude || !r.longitude) return;
        const color = tierColor[r.tier] || '#475569';
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:9px;height:9px;border-radius:50%;background:${color};border:1.5px solid rgba(255,255,255,0.3);box-shadow:0 0 4px ${color}60"></div>`,
          iconSize: [9, 9], iconAnchor: [4.5, 4.5],
        });
        const m = L.marker([parseFloat(r.latitude), parseFloat(r.longitude)], { icon })
          .bindPopup(`
            <div style="min-width:160px">
              <div style="font-weight:700;font-size:13px;color:#E2E8F0;margin-bottom:4px">${r.name}</div>
              <div style="font-family:JetBrains Mono,monospace;font-size:22px;font-weight:800;color:${color};margin:4px 0">${r.latest_score || '—'}</div>
              <div style="font-size:11px;color:#64748B">${r.city} · ${r.inspection_count || 0} inspections</div>
              ${r.total_critical > 0 ? `<div style="color:#F87171;font-size:11px;margin-top:2px">⚠ ${r.total_critical} critical</div>` : ''}
            </div>
          `);
        m.addTo(group);
        markersRef.current[r.business_id] = { marker: m, data: r };
      });
      layersRef.current.restaurants = group.addTo(map);
    }).catch(() => {});
  }

  function loadEquityLayer(map, L) {
    if (layersRef.current.equity) return;
    fetch('/flask/api/food-equity-geojson').then(r => r.json()).then(gj => {
      const vals = gj.features.map(f => f.properties.food_equity_score || 0);
      const minV = Math.min(...vals), maxV = Math.max(...vals);
      layersRef.current.equity = L.geoJSON(gj, {
        style: f => {
          const v = f.properties.food_equity_score || 0;
          const t = maxV > minV ? (v - minV) / (maxV - minV) : 0;
          return {
            fillColor: interpColor(t, [220, 38, 38], [34, 197, 94]),
            fillOpacity: 0.55, color: '#0D1017', weight: 0.5,
          };
        },
        onEachFeature: (f, l) => {
          const p = f.properties;
          l.bindPopup(`<b>Tract ${(p.geoid || '').slice(-6)}</b><br>Equity Score: ${p.food_equity_score}<br>Tier: ${(p.equity_tier || '').replace(/_/g, ' ')}<br>Income: $${(p.median_household_income || 0).toLocaleString()}`);
        }
      }).addTo(map);
    }).catch(() => {});
  }

  function loadDesertLayer(map, L) {
    if (layersRef.current.deserts) return;
    fetch('/flask/api/food-access-geojson').then(r => r.json()).then(gj => {
      layersRef.current.deserts = L.geoJSON(gj, {
        style: f => {
          const p = f.properties;
          if (!p.is_food_desert) return { fillOpacity: 0, color: 'transparent', weight: 0 };
          return {
            fillColor: p.is_severe ? '#F87171' : '#C084FC',
            fillOpacity: 0.6, color: '#0D1017', weight: 0.5,
          };
        },
        onEachFeature: (f, l) => {
          const p = f.properties;
          if (!p.is_food_desert) return;
          l.bindPopup(`<b>Tract ${(p.geoid || '').slice(-6)}</b><br>${p.is_severe ? '⚠ SEVERE' : ''} Food Desert<br>Biz: ${p.food_biz_count} · Pop: ${(p.total_population || 0).toLocaleString()}<br>Poverty: ${p.poverty_rate_pct}%`);
        }
      }).addTo(map);
    }).catch(() => {});
  }

  function loadMLRiskLayer(map, L) {
    if (layersRef.current.mlrisk) return;
    Promise.all([
      fetch('/flask/api/ml-risk').then(r => r.json()),
      fetch('/flask/api/food-access-geojson').then(r => r.json()),
    ]).then(([ml, gj]) => {
      const tracts = ml.tracts || [];
      const byGeoid = {};
      tracts.forEach(t => { byGeoid[t.geoid] = t; });
      const TIER_SCORE = { critical: 4, high: 3, moderate: 2, low: 1, minimal: 0 };
      layersRef.current.mlrisk = L.geoJSON(gj, {
        style: f => {
          const t = byGeoid[f.properties.geoid];
          if (!t) return { fillOpacity: 0, weight: 0 };
          const score = TIER_SCORE[t.risk_tier] || 0;
          const colors = ['#60A5FA', '#4ADE80', '#FBBF24', '#FB923C', '#F87171'];
          return { fillColor: colors[score], fillOpacity: 0.6, color: '#0D1017', weight: 0.5 };
        },
        onEachFeature: (f, l) => {
          const t = byGeoid[f.properties.geoid];
          if (!t) return;
          l.bindPopup(`<b>Tract ${(f.properties.geoid || '').slice(-6)}</b><br>Risk: ${t.risk_tier?.toUpperCase()}<br>Score: ${t.risk_score}<br>Pop: ${(t.total_population || 0).toLocaleString()}`);
        }
      }).addTo(map);
    }).catch(() => {});
  }

  function loadFreshFoodLayer(map, L) {
    if (layersRef.current.freshfood) return;
    fetch('/flask/api/fresh-food-points').then(r => r.json()).then(data => {
      const points = data.points || data;
      if (!Array.isArray(points)) return;
      const group = L.layerGroup();
      points.forEach(p => {
        if (!p.latitude || !p.longitude) return;
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:8px;height:8px;border-radius:50%;background:#86EFAC;border:1.5px solid rgba(255,255,255,0.4);box-shadow:0 0 5px #86EFAC60"></div>`,
          iconSize: [8, 8], iconAnchor: [4, 4],
        });
        L.marker([parseFloat(p.latitude), parseFloat(p.longitude)], { icon })
          .bindPopup(`<b>${p.name || 'Fresh Food'}</b><br>${p.city || ''}`)
          .addTo(group);
      });
      layersRef.current.freshfood = group.addTo(map);
    }).catch(() => {});
  }

  function loadFoodTrucksLayer(map, L) {
    if (layersRef.current.trucks) return;
    fetch('/flask/api/food-trucks').then(r => r.json()).then(data => {
      const byCity = data.by_city || {};
      const counts = Object.values(byCity);
      const maxCount = Math.max(...counts, 1);
      const group = L.layerGroup();
      Object.entries(byCity).forEach(([city, cnt]) => {
        const coords = SCC_CITY_CENTROIDS[city];
        if (!coords) return;
        const r = 8 + (cnt / maxCount) * 24;
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:${r*2}px;height:${r*2}px;border-radius:50%;background:rgba(251,191,36,0.25);border:2px solid #FBBF24;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#FBBF24;font-family:JetBrains Mono,monospace">${cnt}</div>`,
          iconSize: [r*2, r*2], iconAnchor: [r, r],
        });
        L.marker(coords, { icon })
          .bindPopup(`<b>${city}</b><br>🚚 ${cnt} food trucks permitted`)
          .addTo(group);
      });
      layersRef.current.trucks = group.addTo(map);
    }).catch(() => {});
  }

  function loadCottageFoodLayer(map, L) {
    if (layersRef.current.cottage) return;
    fetch('/flask/api/cottage-food').then(r => r.json()).then(data => {
      const byCity = data.by_city || {};
      const counts = Object.values(byCity);
      const maxCount = Math.max(...counts, 1);
      const group = L.layerGroup();
      Object.entries(byCity).forEach(([city, cnt]) => {
        const baseCoords = SCC_CITY_CENTROIDS[city];
        if (!baseCoords) return;
        const jitter = [(Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01];
        const coords = [baseCoords[0] + jitter[0], baseCoords[1] + jitter[1]];
        const r = 6 + (cnt / maxCount) * 18;
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:${r*2}px;height:${r*2}px;border-radius:50%;background:rgba(52,211,153,0.25);border:2px solid #34D399;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#34D399;font-family:JetBrains Mono,monospace">${cnt}</div>`,
          iconSize: [r*2, r*2], iconAnchor: [r, r],
        });
        L.marker(coords, { icon })
          .bindPopup(`<b>${city}</b><br>🏠 ${cnt} cottage food producers<br><small style="color:#64748B">Privacy protected — centroid shown</small>`)
          .addTo(group);
      });
      layersRef.current.cottage = group.addTo(map);
    }).catch(() => {});
  }

  function loadCrimeLayer(map, L) {
    if (layersRef.current.crime) return;
    fetch('/flask/api/crime-points').then(r => r.json()).then(data => {
      const points = data.points || data;
      if (!Array.isArray(points)) return;
      const group = L.layerGroup();
      points.slice(0, 2000).forEach(p => {
        if (!p.latitude || !p.longitude) return;
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:5px;height:5px;border-radius:50%;background:rgba(251,146,60,0.7);"></div>`,
          iconSize: [5, 5], iconAnchor: [2.5, 2.5],
        });
        L.marker([parseFloat(p.latitude), parseFloat(p.longitude)], { icon })
          .bindPopup(`<b>${p.type || p.category || 'Incident'}</b><br>${p.date || ''}`)
          .addTo(group);
      });
      layersRef.current.crime = group.addTo(map);
    }).catch(() => {});
  }

  useImperativeHandle(ref, () => ({
    panTo(lat, lon, zoom = 15) {
      mapRef.current?.flyTo([lat, lon], zoom, { duration: 0.8 });
    },
    showChoropleth(records, metricId, color) {
      const map = mapRef.current;
      if (!map || typeof window === 'undefined') return;
      const L = window.L;
      if (layersRef.current.choropleth) { map.removeLayer(layersRef.current.choropleth); }
      fetch('/flask/api/food-access-geojson').then(r => r.json()).then(gj => {
        const byGeoid = {};
        records.forEach(r => { byGeoid[r.geoid] = r; });
        const vals = records.map(r => r[metricId]).filter(v => v != null && v > 0);
        const maxV = Math.max(...vals), minV = Math.min(...vals);
        layersRef.current.choropleth = L.geoJSON(gj, {
          style: f => {
            const r = byGeoid[f.properties.geoid];
            const v = r ? (r[metricId] || 0) : 0;
            const t = maxV > minV ? (v - minV) / (maxV - minV) : 0;
            const rc = Math.round(255 * t), bc = Math.round(180 * (1 - t));
            return { fillColor: `rgb(${rc},60,${bc})`, fillOpacity: 0.6, color: '#222', weight: 0.4 };
          },
          onEachFeature: (f, l) => {
            const r = byGeoid[f.properties.geoid] || {};
            const v = r[metricId];
            l.bindPopup(`<b>Tract ${f.properties.geoid}</b><br>${metricId.replace(/_pct$/, '').replace(/_/g, ' ')}: ${v != null ? v.toFixed(1) + '%' : 'N/A'}`);
          }
        }).addTo(map);
      }).catch(() => {});
    },
    showRoutes(routes) {
      const map = mapRef.current;
      if (!map || typeof window === 'undefined') return;
      const L = window.L;
      if (layersRef.current.routes) { map.removeLayer(layersRef.current.routes); }
      const colors = ['#60A5FA', '#4ADE80', '#F87171', '#FBBF24', '#C084FC'];
      const group = L.layerGroup();
      const allPts = [];
      routes.forEach((route, i) => {
        const color = colors[i % colors.length];
        const pts = route.stops.filter(s => s.lat && s.lon).map(s => [s.lat, s.lon]);
        if (pts.length > 1) L.polyline(pts, { color, weight: 2.5, opacity: 0.8, dashArray: '6,4' }).addTo(group);
        pts.forEach(p => allPts.push(p));
        route.stops.filter(s => !s.depot && s.lat && s.lon).forEach((s, j) => {
          const icon = L.divIcon({ className: '', html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#000;font-family:JetBrains Mono,monospace">${j}</div>` });
          L.marker([s.lat, s.lon], { icon }).bindPopup(`<b>${s.name}</b><br>${s.address || ''}${s.critical > 0 ? `<br>⚠ ${s.critical} critical` : ''}`).addTo(group);
        });
      });
      layersRef.current.routes = group.addTo(map);
      if (allPts.length > 1) {
        try { map.fitBounds(allPts, { padding: [30, 30] }); } catch {}
      }
    },
    highlightMarker(bizId) {
      const entry = markersRef.current[bizId];
      if (entry) entry.marker.openPopup();
    },
  }));

  useEffect(() => {
    if (typeof window === 'undefined' || !divRef.current || mapRef.current) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = window.L;
      const map = L.map(divRef.current, { center: SCC_CENTER, zoom: 11, zoomControl: false });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      mapRef.current = map;
      setReady(true);
      onMapReady?.(map);
      loadRestaurants(map, L);
    };
    document.head.appendChild(script);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div ref={divRef} style={{ width: '100%', height: '100%', background: '#07090F' }} />

      {/* Layer controls panel */}
      {ready && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 500,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {LAYER_DEFS.map(layer => {
            const isOn = activeLayers[layer.id];
            return (
              <button key={layer.id} onClick={() => toggleLayerUI(layer.id)} title={layer.label} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px',
                background: isOn ? `rgba(${hexToRgbStr(layer.color)},0.15)` : 'rgba(13,16,23,0.85)',
                border: `1px solid ${isOn ? layer.color : '#1E2537'}`,
                borderRadius: 6, cursor: 'pointer', backdropFilter: 'blur(4px)',
                transition: 'all 0.15s', color: isOn ? layer.color : '#475569',
                fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                <span>{layer.icon}</span>
                <span>{layer.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {!ready && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07090F', zIndex: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #1E2537', borderTopColor: '#4ADE80', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 12, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>Loading map…</div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
});

function hexToRgbStr(hex) {
  try {
    return [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)).join(',');
  } catch { return '100,116,139'; }
}

export default MapPanel;
