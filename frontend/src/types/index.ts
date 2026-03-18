export interface Restaurant {
  id: string | number;
  name: string;
  address?: string;
  city?: string;
  lat: number;
  lon: number;
  score?: number;
  tier?: "green" | "yellow" | "red" | "unscored";
  criticalCount?: number;
  lastInspection?: string;
}

export interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  sources?: Source[];
  timestamp: Date;
}

export interface Source {
  name: string;
  city?: string;
  score?: number;
  excerpt?: string;
}

export interface Route {
  inspector: number;
  stops: RouteStop[];
  total_distance?: number;
  total_miles?: number;
  engine?: string;
  color?: string;
}

export interface RouteStop {
  id: string | number;
  name: string;
  address?: string;
  city?: string;
  lat: number;
  lon: number;
  priority?: string;
  score?: number;
  tier?: string;
  critical?: number;
  depot?: boolean;
}

export interface DesertTract {
  tract_id: string;
  name?: string;
  lat?: number;
  lon?: number;
  population: number;
  severity: "severe" | "moderate" | "low";
  low_access?: boolean;
  zero_businesses?: boolean;
  poverty_rate?: number;
}

export interface DesertStats {
  total_population_affected: number;
  pct_population: number;
  desert_tracts: number;
  severe_deserts: number;
  low_access_tracts: number;
  zero_business_tracts: number;
  tracts: DesertTract[];
}

export interface HealthMetric {
  id: string;
  label: string;
  endpoint: string;
  unit: string;
}

export interface HealthDataPoint {
  tract_id?: string;
  geoid?: string;
  city?: string;
  lat?: number;
  lon?: number;
  value: number;
  label?: string;
}

export interface Stats {
  green: number;
  yellow: number;
  red: number;
  total: number;
  unscored?: number;
}

export interface Violator {
  rank?: number;
  id: string | number;
  name: string;
  city?: string;
  address?: string;
  lat?: number;
  lon?: number;
  critical_count: number;
  score?: number;
  inspections?: number;
}

export interface CityStats {
  city: string;
  avg_score: number;
  count: number;
  green?: number;
  yellow?: number;
  red?: number;
}

export interface TrendPoint {
  month: string;
  avg_score: number;
  count: number;
}

export interface ViolationType {
  description: string;
  count: number;
  critical_count?: number;
  pct_critical?: number;
}

export interface MapRef {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
  fitBounds: (bounds: [[number, number], [number, number]]) => void;
  showEquityLayer: (show: boolean) => void;
  showDesertLayer: (show: boolean) => void;
  showHealthLayer: (metric: string, data: HealthDataPoint[]) => void;
  drawRoutes: (routes: Route[]) => void;
  clearRoutes: () => void;
}
