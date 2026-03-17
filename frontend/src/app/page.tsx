"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import TabNav, { TabId } from "@/components/TabNav";
import ChatTab from "@/components/tabs/ChatTab";
import DesertsTab from "@/components/tabs/DesertsTab";
import ViolatorsTab from "@/components/tabs/ViolatorsTab";
import CitiesTab from "@/components/tabs/CitiesTab";
import SearchTab from "@/components/tabs/SearchTab";
import TrendsTab from "@/components/tabs/TrendsTab";
import EquityTab from "@/components/tabs/EquityTab";
import WorkforceTab from "@/components/tabs/WorkforceTab";
import CultureTab from "@/components/tabs/CultureTab";
import GpuTab from "@/components/tabs/GpuTab";
import MlRiskTab from "@/components/tabs/MlRiskTab";
import RoutesTab from "@/components/tabs/RoutesTab";
import FreshFoodTab from "@/components/tabs/FreshFoodTab";
import HealthDataTab from "@/components/tabs/HealthDataTab";
import ResourcesTab from "@/components/tabs/ResourcesTab";
import RecallsTab from "@/components/tabs/RecallsTab";
import VisionTab from "@/components/tabs/VisionTab";
import type { Restaurant, Route, HealthDataPoint, MapRef } from "@/types";

// Dynamic import for Leaflet map (no SSR)
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0a0c14",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          border: "2px solid var(--border)",
          borderTop: "2px solid var(--accent)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <div
        style={{
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: "11px",
          color: "var(--text-muted)",
        }}
      >
        Loading map...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
});

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const mapRef = useRef<MapRef>(null);

  // Load all restaurant markers on mount
  useEffect(() => {
    fetch("/api/restaurants").then(r => r.json()).then(d => { setRestaurants(Array.isArray(d) ? d : []); });
  }, []);

  function handleFlyTo(lat: number, lon: number) {
    mapRef.current?.flyTo(lat, lon, 16);
  }

  function handleShowEquityLayer(show: boolean) {
    mapRef.current?.showEquityLayer(show);
  }

  function handleShowHealthLayer(metric: string, data: HealthDataPoint[]) {
    mapRef.current?.showHealthLayer(metric, data);
  }

  function handleDrawRoutes(routes: Route[]) {
    mapRef.current?.drawRoutes(routes);
  }

  function renderTab() {
    switch (activeTab) {
      case "chat":
        return <ChatTab />;
      case "deserts":
        return <DesertsTab onFlyTo={handleFlyTo} />;
      case "violators":
        return <ViolatorsTab onPanTo={handleFlyTo} />;
      case "cities":
        return <CitiesTab />;
      case "search":
        return (
          <SearchTab allMarkers={restaurants} onPanTo={handleFlyTo} />
        );
      case "trends":
        return <TrendsTab />;
      case "equity":
        return <EquityTab onShowEquityLayer={handleShowEquityLayer} />;
      case "workforce":
        return <WorkforceTab />;
      case "culture":
        return <CultureTab />;
      case "gpu":
        return <GpuTab />;
      case "mlrisk":
        return <MlRiskTab />;
      case "routes":
        return <RoutesTab onDrawRoutes={handleDrawRoutes} />;
      case "freshfood":
        return <FreshFoodTab onFlyTo={handleFlyTo} />;
      case "healthdata":
        return <HealthDataTab onShowHealthLayer={handleShowHealthLayer} />;
      case "resources":
        return <ResourcesTab />;
      case "recalls":
        return <RecallsTab />;
      case "vision":
        return <VisionTab />;
      default:
        return null;
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg-base)",
      }}
    >
      {/* Header */}
      <Header />

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left panel */}
        <div
          style={{
            width: "375px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-panel)",
            borderRight: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          {/* Tab navigation */}
          <TabNav active={activeTab} onChange={setActiveTab} />

          {/* Tab content */}
          <div style={{ flex: 1, overflow: "hidden" }}>{renderTab()}</div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <MapView ref={mapRef} restaurants={restaurants} />
        </div>
      </div>
    </div>
  );
}
