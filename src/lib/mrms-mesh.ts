// NOAA MRMS MESH (Maximum Expected Size of Hail) — future provider
// For MVP, lead scoring uses the IEM LSR max-hail report as the damage core proxy.
// MRMS 24h archive: https://mrms.ncep.noaa.gov/data/RIDGEII/L3/CONUS/MESH/

export type MrmsMeshResult = {
  maxHailSizeMm: number         // MESH-estimated max hail size in mm
  hailIntensityScore: number    // 0–10 derived from MESH values
  insideHighImpactZone: boolean // true if MESH > 38mm (1.5")
  distanceToHailCoreKm: number  // distance to peak MESH grid cell
}

export async function getMrmsMeshForLocation(
  _lat: number,
  _lng: number,
  _stormDate: string,  // YYYY-MM-DD
): Promise<MrmsMeshResult | null> {
  return null
}
