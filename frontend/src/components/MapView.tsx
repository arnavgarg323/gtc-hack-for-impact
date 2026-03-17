"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import type { Restaurant, Route, HealthDataPoint, MapRef } from "@/types";

interface MapViewProps {
  restaurants: Restaurant[];
}

const MapView = forwardRef<MapRef, MapViewProps>(function MapView(
  { restaurants },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const equityLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const desertLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const healthLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeLayersRef = useRef<any[]>([]);
  const [controls, setControls] = useState({
    equity: false,
    deserts: false,
    mlrisk: false,
    freshfood: false,
  });
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      // Fix default icon paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center: [37.35, -121.9],
        zoom: 11,
        zoomControl: false,
      });

      // Dark tile layer
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
        }
      ).addTo(map);

      // Zoom control bottom-left
      L.control.zoom({ position: "bottomleft" }).addTo(map);

      // Markers layer group
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
        equityLayerRef.current = null;
        desertLayerRef.current = null;
        healthLayerRef.current = null;
        routeLayersRef.current = [];
      }
    };
  }, []);

  // Load restaurants as markers
  useEffect(() => {
    if (!mapReady || !markersLayerRef.current || !restaurants.length) return;

    import("leaflet").then((L) => {
      markersLayerRef.current.clearLayers();

      restaurants.forEach((r) => {
        if (!r.lat || !r.lon) return;

        const tier =
          r.tier ||
          (r.score == null
            ? "unscored"
            : r.score >= 90
            ? "green"
            : r.score >= 70
            ? "yellow"
            : "red");

        const color =
          tier === "green"
            ? "#5cc88a"
            : tier === "yellow"
            ? "#f0c060"
            : tier === "red"
            ? "#f07070"
            : "#44506a";

        const radius = tier === "unscored" ? 4 : 5;

        const marker = L.circleMarker([r.lat, r.lon], {
          radius,
          fillColor: color,
          color: "rgba(0,0,0,0.4)",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.75,
        });

        const scoreText =
          r.score != null ? `<strong>${r.score}</strong> / 100` : "Unscored";
        marker.bindPopup(
          `<div style="min-width:160px">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:#e8eaf2">${r.name}</div>
            ${r.address ? `<div style="font-size:11px;color:#8892a4;margin-bottom:2px">${r.address}</div>` : ""}
            ${r.city ? `<div style="font-size:11px;color:#8892a4;margin-bottom:6px">${r.city}</div>` : ""}
            <div style="font-size:12px;color:${color}">Score: ${scoreText}</div>
            ${r.criticalCount != null ? `<div style="font-size:11px;color:#f07070;margin-top:2px">Critical violations: ${r.criticalCount}</div>` : ""}
          </div>`
        );

        marker.addTo(markersLayerRef.current);
      });
    });
  }, [mapReady, restaurants]);

  // Load equity layer
  useEffect(() => {
    if (!mapReady || !controls.equity) return;
    if (equityLayerRef.current) return;

    import("leaflet").then(async (L) => {
      try {
        const r = await fetch("/api/equity-layer");
        const d = await r.json();
        const features = Array.isArray(d) ? d : d.features || d.data || [];

        const layer = L.layerGroup();
        features.forEach((f: Record<string, unknown>) => {
          const lat = (f.lat || f.latitude) as number;
          const lon = (f.lon || f.longitude || f.lng) as number;
          const score = (f.avg_score || f.score || f.equity_score || 75) as number;
          if (!lat || !lon) return;
          const color =
            score >= 90 ? "#5cc88a" : score >= 70 ? "#f0c060" : "#f07070";
          L.circle([lat, lon], {
            radius: 300,
            fillColor: color,
            color: "transparent",
            fillOpacity: 0.25,
          }).addTo(layer);
        });

        layer.addTo(mapRef.current);
        equityLayerRef.current = layer;
      } catch {
        // silently fail
      }
    });
  }, [mapReady, controls.equity]);

  // Load desert layer
  useEffect(() => {
    if (!mapReady || !controls.deserts) return;
    if (desertLayerRef.current) return;

    import("leaflet").then(async (L) => {
      try {
        const r = await fetch("/api/food-deserts");
        const d = await r.json();
        const tracts = d.tracts || d.features || [];

        const layer = L.layerGroup();
        tracts.forEach((t: Record<string, unknown>) => {
          const lat = t.lat as number;
          const lon = t.lon as number;
          if (!lat || !lon) return;
          const severity = t.severity as string;
          const color =
            severity === "severe"
              ? "#f07070"
              : severity === "moderate"
              ? "#f0c060"
              : "#b89cf6";
          L.circle([lat, lon], {
            radius: 500,
            fillColor: color,
            color: color,
            weight: 1,
            fillOpacity: 0.2,
          })
            .bindTooltip(
              `Food Desert: ${t.name || t.tract_id}<br>Pop: ${Number(t.population || 0).toLocaleString()}`
            )
            .addTo(layer);
        });

        layer.addTo(mapRef.current);
        desertLayerRef.current = layer;
      } catch {
        // silently fail
      }
    });
  }, [mapReady, controls.deserts]);

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    flyTo(lat: number, lon: number, zoom = 15) {
      if (mapRef.current) {
        mapRef.current.flyTo([lat, lon], zoom, { duration: 1.2 });
      }
    },
    fitBounds(bounds: [[number, number], [number, number]]) {
      if (mapRef.current) {
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    },
    showEquityLayer(show: boolean) {
      setControls((c) => ({ ...c, equity: show }));
      if (!show && equityLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(equityLayerRef.current);
        equityLayerRef.current = null;
      }
    },
    showDesertLayer(show: boolean) {
      setControls((c) => ({ ...c, deserts: show }));
      if (!show && desertLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(desertLayerRef.current);
        desertLayerRef.current = null;
      }
    },
    showHealthLayer(metric: string, data: HealthDataPoint[]) {
      if (!mapRef.current) return;
      import("leaflet").then((L) => {
        if (healthLayerRef.current) {
          mapRef.current.removeLayer(healthLayerRef.current);
        }
        const layer = L.layerGroup();
        const values = data.map((d) => d.value).filter((v) => !isNaN(v));
        const minVal = Math.min(...values, 0);
        const maxVal = Math.max(...values, 1);

        data.forEach((point) => {
          if (!point.lat || !point.lon) return;
          const normalized = (point.value - minVal) / (maxVal - minVal);
          const r = Math.round(normalized * 240);
          const g = Math.round((1 - normalized) * 140 + 40);
          const color = `rgb(${r}, ${g}, 80)`;
          L.circle([point.lat, point.lon], {
            radius: 400,
            fillColor: color,
            color: "transparent",
            fillOpacity: 0.4,
          })
            .bindTooltip(`${metric}: ${point.value.toFixed(1)}`)
            .addTo(layer);
        });

        layer.addTo(mapRef.current);
        healthLayerRef.current = layer;
      });
    },
    drawRoutes(routes: Route[]) {
      if (!mapRef.current) return;
      import("leaflet").then((L) => {
        // Clear existing route layers
        routeLayersRef.current.forEach((layer) => {
          mapRef.current.removeLayer(layer);
        });
        routeLayersRef.current = [];

        routes.forEach((route) => {
          const stops = route.stops || [];
          if (stops.length < 2) return;

          const latLngs = stops
            .filter((s) => s.lat && s.lon)
            .map((s) => [s.lat, s.lon] as [number, number]);

          if (latLngs.length < 2) return;

          const routeLayer = L.layerGroup();

          // Polyline
          L.polyline(latLngs, {
            color: route.color || "#76b900",
            weight: 2.5,
            opacity: 0.8,
            dashArray: "6, 4",
          }).addTo(routeLayer);

          // Stop markers
          stops.forEach((stop, i) => {
            if (!stop.lat || !stop.lon) return;
            L.circleMarker([stop.lat, stop.lon], {
              radius: 7,
              fillColor: route.color || "#76b900",
              color: "#000",
              weight: 1.5,
              fillOpacity: 0.9,
            })
              .bindTooltip(`${i + 1}. ${stop.name}`)
              .addTo(routeLayer);
          });

          routeLayer.addTo(mapRef.current);
          routeLayersRef.current.push(routeLayer);
        });
      });
    },
    clearRoutes() {
      routeLayersRef.current.forEach((layer) => {
        if (mapRef.current) mapRef.current.removeLayer(layer);
      });
      routeLayersRef.current = [];
    },
  }));

  function toggleControl(key: keyof typeof controls) {
    const next = !controls[key];
    setControls((c) => ({ ...c, [key]: next }));

    // Handle layer removal for equity/deserts
    if (!next) {
      if (key === "equity" && equityLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(equityLayerRef.current);
        equityLayerRef.current = null;
      }
      if (key === "deserts" && desertLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(desertLayerRef.current);
        desertLayerRef.current = null;
      }
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Map container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Map controls - top right */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          zIndex: 1000,
        }}
      >
        {(
          [
            { key: "equity", label: "Food Equity" },
            { key: "deserts", label: "Food Deserts" },
            { key: "mlrisk", label: "ML Risk" },
            { key: "freshfood", label: "Fresh Food" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggleControl(key)}
            style={{
              background: controls[key]
                ? "var(--accent)"
                : "rgba(13,15,25,0.92)",
              border: `1px solid ${controls[key] ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "5px",
              color: controls[key] ? "#000" : "var(--text-secondary)",
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "10px",
              fontWeight: controls[key] ? 600 : 400,
              padding: "5px 10px",
              cursor: "pointer",
              transition: "all 0.15s",
              backdropFilter: "blur(8px)",
              whiteSpace: "nowrap",
            }}
          >
            {controls[key] ? "✓ " : ""}
            {label}
          </button>
        ))}
      </div>

      {/* Legend - bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: "32px",
          right: "12px",
          background: "rgba(13,15,25,0.92)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "8px 10px",
          zIndex: 1000,
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: "9px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "6px",
          }}
        >
          Safety Score
        </div>
        {[
          { color: "#5cc88a", label: "Safe (90+)" },
          { color: "#f0c060", label: "Fair (70–89)" },
          { color: "#f07070", label: "Poor (<70)" },
          { color: "#44506a", label: "Unscored" },
        ].map((l) => (
          <div
            key={l.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "3px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: l.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: "9px",
                color: "var(--text-secondary)",
              }}
            >
              {l.label}
            </span>
          </div>
        ))}
      </div>

      {/* Restaurant count */}
      {restaurants.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            left: "48px",
            background: "rgba(13,15,25,0.85)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            padding: "4px 8px",
            zIndex: 1000,
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: "10px",
            color: "var(--text-muted)",
            backdropFilter: "blur(6px)",
          }}
        >
          {restaurants.length.toLocaleString()} locations
        </div>
      )}
    </div>
  );
});

export default MapView;
