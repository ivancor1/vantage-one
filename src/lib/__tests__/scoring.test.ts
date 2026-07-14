// Unit tests on the money math — the two functions that decide which door a roofer
// knocks first. If these are wrong, the product is wrong.
import { describe, it, expect } from 'vitest'
import { computeCompositeScore } from '../lead-scoring'
import { interpolateHail, bboxAround, stormDateRange } from '../hail'

describe('computeCompositeScore', () => {
  it('is neutral (50) with no signals at all', () => {
    expect(computeCompositeScore({})).toBe(50)
  })

  it('hail evidence dominates the score', () => {
    const noHail = computeCompositeScore({ roofAge: 20, hailRiskScore: 80 })
    const withHail = computeCompositeScore({ roofAge: 20, hailRiskScore: 80, radarHailIn: 2.0 })
    expect(withHail).toBeGreaterThan(noHail)
    expect(withHail).toBeGreaterThanOrEqual(80) // 2" radar hail on an old roof is a top lead
  })

  it('two independent sources agreeing beats one source of the same size', () => {
    const oneSource = computeCompositeScore({ radarHailIn: 1.5 })
    const twoSources = computeCompositeScore({ radarHailIn: 1.5, spotterHailIn: 1.5 })
    expect(twoSources).toBeGreaterThan(oneSource)
  })

  it('bigger hail scores higher', () => {
    const small = computeCompositeScore({ radarHailIn: 0.75 })
    const big = computeCompositeScore({ radarHailIn: 2.5 })
    expect(big).toBeGreaterThan(small)
  })

  it('a worn roof raises a hail-confirmed lead, but never dominates without hail', () => {
    const base = computeCompositeScore({ radarHailIn: 1.5 })
    const worn = computeCompositeScore({ radarHailIn: 1.5, vulnerabilityScore: 90 })
    expect(worn).toBeGreaterThan(base)

    // With NO hail, even a terrible-looking roof can't crack the HIGH band (65+)
    const noHailWorn = computeCompositeScore({ vulnerabilityScore: 100 })
    expect(noHailWorn).toBeLessThan(65)
  })

  it('real roof age is used over the area estimate', () => {
    const areaOnly = computeCompositeScore({ radarHailIn: 1.0, areaHousingAgeScore: 2 })
    const oldRoof = computeCompositeScore({ radarHailIn: 1.0, roofAge: 20, areaHousingAgeScore: 2 })
    expect(oldRoof).toBeGreaterThan(areaOnly)
  })

  it('is always clamped to 0..100', () => {
    expect(computeCompositeScore({ radarHailIn: 10, spotterHailIn: 10, vulnerabilityScore: 100, roofAge: 50, hailRiskScore: 100 })).toBeLessThanOrEqual(100)
  })
})

describe('interpolateHail (IDW over real report points)', () => {
  const home = { lat: 36.05, lng: -95.79 }

  it('returns null with no usable points', () => {
    expect(interpolateHail([], home.lat, home.lng)).toBeNull()
    expect(interpolateHail([{ lat: 1, lng: 1, inches: 0 }], home.lat, home.lng)).toBeNull()
  })

  it('a single report yields exactly that report size', () => {
    const est = interpolateHail([{ lat: 36.10, lng: -95.79, inches: 1.75 }], home.lat, home.lng)
    expect(est?.hailInches).toBe(1.75)
    expect(est?.n).toBe(1)
  })

  it('weights the nearer report more', () => {
    const est = interpolateHail(
      [
        { lat: 36.051, lng: -95.79, inches: 2.0 },  // ~0.1 km away
        { lat: 36.50,  lng: -95.79, inches: 0.9 },  // ~50 km away
      ],
      home.lat, home.lng
    )
    expect(est!.hailInches).toBeGreaterThan(1.9) // dominated by the close 2.0" report
  })

  it('reports the true nearest distance (not the floored one)', () => {
    const est = interpolateHail([{ lat: home.lat, lng: home.lng, inches: 1.0 }], home.lat, home.lng)
    expect(est!.nearestKm).toBe(0)
    expect(est!.hailInches).toBe(1.0) // 0.5 km floor stabilizes weights, not values
  })
})

describe('hail helpers', () => {
  it('bboxAround caps the half-width and stays ordered', () => {
    const b = bboxAround(36, -95, 500)
    expect(b.e).toBeGreaterThan(b.w)
    expect(b.n).toBeGreaterThan(b.s)
    expect((b.n - b.s) / 2 * 111).toBeLessThanOrEqual(61) // capped at 60 km
  })

  it('stormDateRange covers UTC spillover into the next day', () => {
    const [start, end] = stormDateRange('2026-07-11')
    expect(start).toBe('2026-07-11')
    expect(end).toBe('2026-07-13')
  })
})
