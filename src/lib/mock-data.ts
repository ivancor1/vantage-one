export type Storm = {
  id: string
  name: string
  location: string
  date: string
  lat: number
  lng: number
  hailSize: number
  windSpeed: number
  severity: number
  estimatedHomes: number
  affectedZips: string[]
  radiusMeters: number
}

export type LeadStatus =
  | 'new'
  | 'knocked'
  | 'interested'
  | 'inspection'
  | 'claim'
  | 'closed'
  | 'not_qualified'

export type Property = {
  id: string
  stormId: string
  address: string
  lat: number
  lng: number
  leadScore: number
  damageScore: number
  insuranceCarrier: string
  roofAge: number
  claimType: string
  status: LeadStatus
  aiNotes: string
  satelliteUrl: string
}

export const MOCK_STORMS: Storm[] = [
  {
    id: 'storm-1',
    name: 'North Dallas Supercell',
    location: 'Plano, TX',
    date: '2024-05-03',
    lat: 33.0198,
    lng: -96.6989,
    hailSize: 2.25,
    windSpeed: 65,
    severity: 9.2,
    estimatedHomes: 3400,
    affectedZips: ['75023', '75024', '75025', '75074'],
    radiusMeters: 9000,
  },
  {
    id: 'storm-2',
    name: 'Edmond Hail Event',
    location: 'Edmond, OK',
    date: '2024-04-27',
    lat: 35.6528,
    lng: -97.4781,
    hailSize: 3.0,
    windSpeed: 85,
    severity: 9.8,
    estimatedHomes: 2200,
    affectedZips: ['73003', '73012', '73034'],
    radiusMeters: 7500,
  },
  {
    id: 'storm-3',
    name: 'Aurora Front Range Storm',
    location: 'Aurora, CO',
    date: '2024-06-15',
    lat: 39.7294,
    lng: -104.8319,
    hailSize: 1.75,
    windSpeed: 45,
    severity: 7.8,
    estimatedHomes: 1800,
    affectedZips: ['80010', '80011', '80012'],
    radiusMeters: 6500,
  },
]

export const MOCK_PROPERTIES: Property[] = [
  // --- Plano TX (storm-1) ---
  {
    id: 'p-101', stormId: 'storm-1',
    address: '3421 Heritage Oak Ln, Plano, TX 75023',
    lat: 33.047, lng: -96.718,
    leadScore: 94, damageScore: 9.1, insuranceCarrier: 'State Farm',
    roofAge: 14, claimType: 'Wind/Hail', status: 'new',
    aiNotes: 'Significant hail impact patterns across 80% of roof surface. Multiple bruising sites along ridge line. High probability of claim approval.',
    satelliteUrl: 'https://picsum.photos/seed/p101/400/300',
  },
  {
    id: 'p-102', stormId: 'storm-1',
    address: '5801 W Parker Rd, Plano, TX 75093',
    lat: 33.031, lng: -96.682,
    leadScore: 88, damageScore: 8.4, insuranceCarrier: 'Allstate',
    roofAge: 11, claimType: 'Hail Only', status: 'new',
    aiNotes: 'Dense impact field on south-facing slope. 4–5 puncture sites detected. Granule loss consistent with 2"+ hail.',
    satelliteUrl: 'https://picsum.photos/seed/p102/400/300',
  },
  {
    id: 'p-103', stormId: 'storm-1',
    address: '2304 Ridgecrest Dr, Plano, TX 75025',
    lat: 33.009, lng: -96.723,
    leadScore: 81, damageScore: 7.8, insuranceCarrier: 'Farmers',
    roofAge: 9, claimType: 'Wind/Hail', status: 'knocked',
    aiNotes: 'Moderate impact patterns across all roof sections. Ridge cap displacement visible. Recommend prompt inspection.',
    satelliteUrl: 'https://picsum.photos/seed/p103/400/300',
  },
  {
    id: 'p-104', stormId: 'storm-1',
    address: '1109 Windsong Trail, Plano, TX 75023',
    lat: 33.057, lng: -96.668,
    leadScore: 76, damageScore: 7.2, insuranceCarrier: 'Liberty Mutual',
    roofAge: 8, claimType: 'Wind Only', status: 'new',
    aiNotes: 'Wind-driven damage on north exposure. Lifted shingles at eave line. Minor puncture probability.',
    satelliteUrl: 'https://picsum.photos/seed/p104/400/300',
  },
  {
    id: 'p-105', stormId: 'storm-1',
    address: '4415 Briar Grove Ct, Plano, TX 75024',
    lat: 33.023, lng: -96.701,
    leadScore: 71, damageScore: 6.9, insuranceCarrier: 'USAA',
    roofAge: 7, claimType: 'Hail Only', status: 'interested',
    aiNotes: 'Scattered impact sites on east section. Cosmetic damage likely but warrants inspection given hail size.',
    satelliteUrl: 'https://picsum.photos/seed/p105/400/300',
  },
  {
    id: 'p-106', stormId: 'storm-1',
    address: '8820 Preston Rd, Plano, TX 75024',
    lat: 33.041, lng: -96.695,
    leadScore: 65, damageScore: 6.1, insuranceCarrier: 'Nationwide',
    roofAge: 6, claimType: 'Wind/Hail', status: 'new',
    aiNotes: 'Minimal visible impact. Some granule displacement on older sections. Lower priority but in active zone.',
    satelliteUrl: 'https://picsum.photos/seed/p106/400/300',
  },
  {
    id: 'p-107', stormId: 'storm-1',
    address: '641 Crestbrook Dr, Plano, TX 75075',
    lat: 33.015, lng: -96.742,
    leadScore: 58, damageScore: 5.5, insuranceCarrier: 'Progressive',
    roofAge: 5, claimType: 'Hail Only', status: 'new',
    aiNotes: 'Light impact pattern. Roof relatively new. Claim likelihood moderate.',
    satelliteUrl: 'https://picsum.photos/seed/p107/400/300',
  },

  // --- Edmond OK (storm-2) ---
  {
    id: 'p-201', stormId: 'storm-2',
    address: '1804 NW 178th St, Edmond, OK 73012',
    lat: 35.651, lng: -97.476,
    leadScore: 97, damageScore: 9.6, insuranceCarrier: 'State Farm',
    roofAge: 17, claimType: 'Wind/Hail', status: 'new',
    aiNotes: 'Extreme hail impact. Multiple structural punctures across entire roof plane. Immediate inspection recommended. High claim value.',
    satelliteUrl: 'https://picsum.photos/seed/p201/400/300',
  },
  {
    id: 'p-202', stormId: 'storm-2',
    address: '3302 Braxton Hollow Rd, Edmond, OK 73003',
    lat: 35.663, lng: -97.461,
    leadScore: 91, damageScore: 9.0, insuranceCarrier: 'Farmers',
    roofAge: 15, claimType: 'Wind/Hail', status: 'new',
    aiNotes: 'Heavy bruising throughout. Ridge and hip damage consistent with 3"+ hail. Very high replacement probability.',
    satelliteUrl: 'https://picsum.photos/seed/p202/400/300',
  },
  {
    id: 'p-203', stormId: 'storm-2',
    address: '509 Silverwood Dr, Edmond, OK 73034',
    lat: 35.637, lng: -97.489,
    leadScore: 85, damageScore: 8.3, insuranceCarrier: 'Allstate',
    roofAge: 12, claimType: 'Wind/Hail', status: 'knocked',
    aiNotes: 'Widespread impact across all exposures. Downspout and gutter damage visible. Strong case for full replacement.',
    satelliteUrl: 'https://picsum.photos/seed/p203/400/300',
  },
  {
    id: 'p-204', stormId: 'storm-2',
    address: '1120 Timbergate Dr, Edmond, OK 73012',
    lat: 35.658, lng: -97.471,
    leadScore: 79, damageScore: 7.6, insuranceCarrier: 'USAA',
    roofAge: 10, claimType: 'Hail Only', status: 'new',
    aiNotes: 'Concentrated impact zone on south slope. Likely partial claim. Good candidate for supplement.',
    satelliteUrl: 'https://picsum.photos/seed/p204/400/300',
  },
  {
    id: 'p-205', stormId: 'storm-2',
    address: '2244 Fallen Leaf Ln, Edmond, OK 73003',
    lat: 35.644, lng: -97.482,
    leadScore: 72, damageScore: 6.8, insuranceCarrier: 'Liberty Mutual',
    roofAge: 8, claimType: 'Wind Only', status: 'new',
    aiNotes: 'Wind uplift damage on north face. Missing shingles at rake edges. Moderate claim potential.',
    satelliteUrl: 'https://picsum.photos/seed/p205/400/300',
  },

  // --- Aurora CO (storm-3) ---
  {
    id: 'p-301', stormId: 'storm-3',
    address: '1728 S Buckley Rd, Aurora, CO 80017',
    lat: 39.728, lng: -104.823,
    leadScore: 83, damageScore: 8.0, insuranceCarrier: 'State Farm',
    roofAge: 13, claimType: 'Wind/Hail', status: 'new',
    aiNotes: 'Clear hail impact on southern exposure. Impact field density consistent with 1.75" hail. Recommend inspection.',
    satelliteUrl: 'https://picsum.photos/seed/p301/400/300',
  },
  {
    id: 'p-302', stormId: 'storm-3',
    address: '3056 S Reservoir Rd, Aurora, CO 80013',
    lat: 39.742, lng: -104.851,
    leadScore: 77, damageScore: 7.4, insuranceCarrier: 'Nationwide',
    roofAge: 11, claimType: 'Hail Only', status: 'new',
    aiNotes: 'Moderate damage across flat roof sections. Membrane bruising consistent with storm track.',
    satelliteUrl: 'https://picsum.photos/seed/p302/400/300',
  },
  {
    id: 'p-303', stormId: 'storm-3',
    address: '15204 E Hampden Ave, Aurora, CO 80013',
    lat: 39.718, lng: -104.836,
    leadScore: 69, damageScore: 6.5, insuranceCarrier: 'Farmers',
    roofAge: 8, claimType: 'Wind/Hail', status: 'inspection',
    aiNotes: 'Mixed impact across roof. Newer materials reducing severity. Partial repair likely.',
    satelliteUrl: 'https://picsum.photos/seed/p303/400/300',
  },
  {
    id: 'p-304', stormId: 'storm-3',
    address: '22103 E Florida Ave, Aurora, CO 80018',
    lat: 39.751, lng: -104.818,
    leadScore: 62, damageScore: 5.9, insuranceCarrier: 'Progressive',
    roofAge: 7, claimType: 'Wind Only', status: 'new',
    aiNotes: 'Wind-only pattern at this address. Damage appears cosmetic. Lower replacement probability.',
    satelliteUrl: 'https://picsum.photos/seed/p304/400/300',
  },
  {
    id: 'p-305', stormId: 'storm-3',
    address: '9812 E Yale Ave, Aurora, CO 80014',
    lat: 39.733, lng: -104.842,
    leadScore: 55, damageScore: 5.2, insuranceCarrier: 'Allstate',
    roofAge: 5, claimType: 'Hail Only', status: 'new',
    aiNotes: 'Light hail impact on newer roof. Low claim probability but worth a door knock given storm severity.',
    satelliteUrl: 'https://picsum.photos/seed/p305/400/300',
  },
]
