import { NextRequest, NextResponse } from 'next/server'
import { fetchPropertiesNearStorm } from '@/lib/overpass'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const stormId  = searchParams.get('stormId')
  const lat      = parseFloat(searchParams.get('lat') ?? '')
  const lng      = parseFloat(searchParams.get('lng') ?? '')
  const radius   = parseFloat(searchParams.get('radius') ?? '')
  const severity = parseFloat(searchParams.get('severity') ?? '')

  if (!stormId || isNaN(lat) || isNaN(lng) || isNaN(radius) || isNaN(severity)) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 })
  }

  try {
    const properties = await fetchPropertiesNearStorm(stormId, lat, lng, radius, severity)
    return NextResponse.json(properties)
  } catch (err) {
    console.error('[api/properties]', err)
    return NextResponse.json({ error: 'Failed to fetch property data' }, { status: 500 })
  }
}
