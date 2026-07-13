import { NextRequest, NextResponse } from 'next/server'

const STATE_ABBR: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
  Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
  'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA',
  'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN',
  Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
  'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
}

type NominatimAddress = {
  city?: string; town?: string; village?: string; hamlet?: string
  suburb?: string; neighbourhood?: string; county?: string; state?: string
}

function extractPlaceName(address: NominatimAddress): string {
  const city =
    address.city ?? address.town ?? address.village ??
    address.hamlet ?? address.suburb ?? address.neighbourhood ?? address.county ?? ''
  const state = address.state ?? ''
  const stateAbbr = STATE_ABBR[state] ?? state
  if (city && stateAbbr) return `${city}, ${stateAbbr}`
  return city || stateAbbr
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 })

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1&countrycodes=us`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'vantage-app/1.0 (roofing-lead-intelligence)',
      'Accept': 'application/json',
    },
  })

  if (!res.ok) return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 502 })

  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  const result = data[0]
  const placeName = extractPlaceName(result.address ?? {})

  return NextResponse.json({
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    displayName: result.display_name as string,
    placeName,
  })
}
