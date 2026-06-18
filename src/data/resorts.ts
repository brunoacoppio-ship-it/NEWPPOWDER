export interface Resort {
  id: string;
  name: string;
  country: string;
  region: string;
  /** Season zone (drives the in-season date window — see data/seasons.ts).
   *  Coarser than `region`: every Andes sub-region shares the same ski winter. */
  seasonZone: string;
  lat: number;
  lon: number;
  baseElevation: number;
  topElevation: number;
  /** Pacific-facing (Chile) gets moisture first; leeward (Argentina) lives on spillover. */
  windward: boolean;
  /** Static travel logistics (item 4.3). */
  logistics: {
    baseCity: string;
    driveKm: number;
    driveTime: string;   // approximate door-to-door drive
    airport: string;     // nearest practical airport + IATA
  };
  /** Manual webcam fallback (item 5.2). Used when the Windy Webcams API returns
   *  nothing nearby (or no API key is set). Leave empty for now. */
  webcamUrl?: string;
}

export const RESORTS: Resort[] = [
  // South American Andes — windward (Chilean) side
  { id: "valle-nevado", name: "Valle Nevado", country: "CL", region: "Andes centrais", seasonZone: "Andes",
    lat: -33.3539, lon: -70.2486, baseElevation: 2860, topElevation: 3670, windward: true,
    logistics: { baseCity: "Santiago", driveKm: 46, driveTime: "~1h30", airport: "Santiago (SCL)" } },
  { id: "portillo", name: "Portillo", country: "CL", region: "Andes centrais", seasonZone: "Andes",
    lat: -32.8347, lon: -70.1294, baseElevation: 2880, topElevation: 3310, windward: true,
    logistics: { baseCity: "Santiago", driveKm: 145, driveTime: "~2h30", airport: "Santiago (SCL)" } },
  { id: "nevados-chillan", name: "Nevados de Chillán", country: "CL", region: "Andes do sul", seasonZone: "Andes",
    lat: -36.9058, lon: -71.4061, baseElevation: 1600, topElevation: 2700, windward: true,
    logistics: { baseCity: "Chillán", driveKm: 80, driveTime: "~1h30", airport: "Concepción (CCP)" } },
  { id: "corralco", name: "Corralco", country: "CL", region: "Andes do sul", seasonZone: "Andes",
    lat: -38.4333, lon: -71.5000, baseElevation: 1440, topElevation: 2400, windward: true,
    logistics: { baseCity: "Temuco", driveKm: 120, driveTime: "~2h", airport: "Temuco (ZCO)" } },
  // Andes — leeward (Argentine) side
  { id: "las-lenas", name: "Las Leñas", country: "AR", region: "Andes", seasonZone: "Andes",
    lat: -35.1494, lon: -70.0833, baseElevation: 2240, topElevation: 3430, windward: false,
    logistics: { baseCity: "Malargüe", driveKm: 70, driveTime: "~1h15", airport: "San Rafael (AFA)" } },
  { id: "chapelco", name: "Chapelco", country: "AR", region: "Andes", seasonZone: "Andes",
    lat: -40.2167, lon: -71.4500, baseElevation: 1250, topElevation: 1980, windward: false,
    logistics: { baseCity: "San Martín de los Andes", driveKm: 20, driveTime: "~30 min", airport: "Chapelco (CPC)" } },
  { id: "cerro-castor", name: "Cerro Castor", country: "AR", region: "Patagônia", seasonZone: "Andes",
    lat: -54.7211, lon: -68.0094, baseElevation: 195, topElevation: 1057, windward: false,
    logistics: { baseCity: "Ushuaia", driveKm: 26, driveTime: "~30 min", airport: "Ushuaia (USH)" } },
];

export const REGIONS = [...new Set(RESORTS.map((r) => r.region))];

export const COUNTRY_FLAGS: Record<string, string> = {
  CL: "🇨🇱", AR: "🇦🇷",
};
