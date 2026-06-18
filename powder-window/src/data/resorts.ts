export interface Resort {
  id: string;
  name: string;
  country: string;
  region: string;
  lat: number;
  lon: number;
  baseElevation: number;
  topElevation: number;
  /** Pacific-facing (Chile) gets moisture first; leeward (Argentina) lives on spillover. */
  windward: boolean;
}

export const RESORTS: Resort[] = [
  // South American Andes — windward (Chilean) side
  { id: "valle-nevado", name: "Valle Nevado", country: "CL", region: "Andes centrais",
    lat: -33.3539, lon: -70.2486, baseElevation: 2860, topElevation: 3670, windward: true },
  { id: "portillo", name: "Portillo", country: "CL", region: "Andes centrais",
    lat: -32.8347, lon: -70.1294, baseElevation: 2880, topElevation: 3310, windward: true },
  { id: "nevados-chillan", name: "Nevados de Chillán", country: "CL", region: "Andes do sul",
    lat: -36.9058, lon: -71.4061, baseElevation: 1600, topElevation: 2700, windward: true },
  { id: "corralco", name: "Corralco", country: "CL", region: "Andes do sul",
    lat: -38.4333, lon: -71.5000, baseElevation: 1440, topElevation: 2400, windward: true },
  // Andes — leeward (Argentine) side
  { id: "las-lenas", name: "Las Leñas", country: "AR", region: "Andes",
    lat: -35.1494, lon: -70.0833, baseElevation: 2240, topElevation: 3430, windward: false },
  { id: "chapelco", name: "Chapelco", country: "AR", region: "Andes",
    lat: -40.2167, lon: -71.4500, baseElevation: 1250, topElevation: 1980, windward: false },
  { id: "cerro-castor", name: "Cerro Castor", country: "AR", region: "Patagônia",
    lat: -54.7211, lon: -68.0094, baseElevation: 195, topElevation: 1057, windward: false },
];

export const REGIONS = [...new Set(RESORTS.map((r) => r.region))];

export const COUNTRY_FLAGS: Record<string, string> = {
  CL: "🇨🇱", AR: "🇦🇷",
};
