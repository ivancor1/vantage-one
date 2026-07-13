export type CountyArcGISConfig = {
  name:           string
  // Primary parcel layer — address-based LIKE query
  parcelsUrl:     string
  addressField:   string        // field to match against the street portion of address
  parcelIdField:  string        // APN, PIN, TAXPIN, ParcelID, etc.
  yearBuiltField: string | null // null → year_built comes from structuresUrl instead
  landUseField:   string | null // LUCDesc, DESCR, LC_CUR, CLASS — used for residential filter
  acresField:     string | null // field in acres; null if only sqft available
  sqftField:      string | null // field in sqft (converted to acres automatically)
  // Optional separate spatial layer for year_built (Fulton County GA pattern)
  structuresUrl?: string
  residentialTerms: string[]    // substrings to match in landUseField for residential check
}

export const COUNTY_REGISTRY: Record<string, CountyArcGISConfig> = {
  // Fulton County, GA — Atlanta metro (two-layer pattern)
  '13121': {
    name:             'Fulton County, GA',
    parcelsUrl:       'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/arcgis/rest/services/Tax_Parcels/FeatureServer/0/query',
    addressField:     'Address',
    parcelIdField:    'ParcelID',
    yearBuiltField:   null,       // comes from structuresUrl
    landUseField:     null,       // comes from structuresUrl (LUCDesc)
    acresField:       'LandAcres',
    sqftField:        null,
    structuresUrl:    'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/arcgis/rest/services/Structures/FeatureServer/0/query',
    residentialTerms: ['residential', 'single family', 'townhouse', 'condominium', 'condo', 'multi-family', 'multifamily', 'duplex'],
  },

  // Maricopa County, AZ — Phoenix metro (single-layer)
  '04013': {
    name:             'Maricopa County, AZ',
    parcelsUrl:       'https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0/query',
    addressField:     'PHYSICAL_ADDRESS',
    parcelIdField:    'APN',
    yearBuiltField:   'CONST_YEAR',
    landUseField:     'LC_CUR',
    acresField:       null,
    sqftField:        'LAND_SIZE',  // converted to acres on read
    residentialTerms: ['.r', 'r.'],  // Maricopa LC_CUR codes like '1.R', '2.R'
  },

  // Tarrant County, TX — Fort Worth metro (single-layer)
  '48439': {
    name:             'Tarrant County, TX',
    parcelsUrl:       'https://mapit.tarrantcounty.com/arcgis/rest/services/Tax/TCProperty/MapServer/0/query',
    addressField:     'SITUS_ADDR',
    parcelIdField:    'TAXPIN',
    yearBuiltField:   'YEAR_BUILT',
    landUseField:     'DESCR',
    acresField:       'LAND_ACRES',
    sqftField:        null,
    residentialTerms: ['res', 'sfr', 'single', 'duplex', 'townhouse', 'condo', 'townhome'],
  },

  // Douglas County, NE — Omaha metro (single-layer)
  '31055': {
    name:             'Douglas County, NE',
    parcelsUrl:       'https://dcgis.org/server/rest/services/vector/Parcels_public/FeatureServer/0/query',
    addressField:     'PROPERTY_A',
    parcelIdField:    'PIN',
    yearBuiltField:   'BLDG_YRBLT',
    landUseField:     'CLASS',
    acresField:       'ACRES',
    sqftField:        null,
    residentialTerms: ['r', 's', 'a'],  // Douglas CLASS codes for residential
  },
}

export function getCountyConfig(fips: string): CountyArcGISConfig | null {
  return COUNTY_REGISTRY[fips] ?? null
}

export function supportedCountyCount(): number {
  return Object.keys(COUNTY_REGISTRY).length
}
