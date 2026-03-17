'use client';
import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Header from '../components/Header';
import TabBar from '../components/TabBar';
import ChatTab from '../components/ChatTab';
import ViolatorsTab from '../components/ViolatorsTab';
import CitiesTab from '../components/CitiesTab';
import SearchTab from '../components/SearchTab';
import TrendsTab from '../components/TrendsTab';
import CultureTab from '../components/CultureTab';
import RoutesTab from '../components/RoutesTab';
import HealthDataTab from '../components/HealthDataTab';
import EquityTab from '../components/EquityTab';
import FreshFoodTab from '../components/FreshFoodTab';
import MLRiskTab from '../components/MLRiskTab';
import ResourcesTab from '../components/ResourcesTab';
import DesertsTab from '../components/DesertsTab';
import WorkforceTab from '../components/WorkforceTab';
import GPUTab from '../components/GPUTab';
import RecallsTab from '../components/RecallsTab';
import SimulationModal from '../components/SimulationModal';

const MapPanel = dynamic(() => import('../components/MapPanel'), { ssr: false });

export default function Home() {
  const [tab, setTab] = useState('chat');
  const [simGeoid, setSimGeoid] = useState(null);
  const mapRef = useRef(null);

  function handlePan(r) {
    if (r.lat && r.lon) mapRef.current?.panTo(r.lat, r.lon);
    else if (r.latitude && r.longitude) mapRef.current?.panTo(parseFloat(r.latitude), parseFloat(r.longitude));
  }

  function handleSimulate(geoid) {
    setSimGeoid(geoid);
  }

  const panel = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {tab === 'chat' && <ChatTab />}
      {tab === 'deserts' && <DesertsTab onPan={handlePan} onSimulate={handleSimulate} />}
      {tab === 'violators' && <ViolatorsTab onPan={handlePan} />}
      {tab === 'cities' && <CitiesTab />}
      {tab === 'search' && <SearchTab onPan={handlePan} />}
      {tab === 'trends' && <TrendsTab />}
      {tab === 'equity' && <EquityTab onSimulate={handleSimulate} />}
      {tab === 'culture' && <CultureTab />}
      {tab === 'freshfood' && <FreshFoodTab />}
      {tab === 'healthdata' && <HealthDataTab onChoropleth={(records, metric, color) => mapRef.current?.showChoropleth(records, metric, color)} />}
      {tab === 'mlrisk' && <MLRiskTab />}
      {tab === 'routes' && <RoutesTab onRoutes={(routes) => mapRef.current?.showRoutes(routes)} />}
      {tab === 'resources' && <ResourcesTab />}
      {tab === 'workforce' && <WorkforceTab />}
      {tab === 'gpu' && <GPUTab />}
      {tab === 'recalls' && <RecallsTab />}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative', zIndex: 1 }}>
      <Header />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel */}
        <div style={{ width: 370, minWidth: 370, display: 'flex', flexDirection: 'column', background: '#0D1017', borderRight: '1px solid #1E2537' }}>
          <TabBar active={tab} onChange={setTab} />
          {panel}
        </div>
        {/* Map */}
        <MapPanel ref={mapRef} />
      </div>

      {/* Simulation Modal */}
      {simGeoid && (
        <SimulationModal
          geoid={simGeoid}
          onClose={() => setSimGeoid(null)}
        />
      )}
    </div>
  );
}
