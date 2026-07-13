// Socrata building permit lookup — not yet wired into scrape pipeline
// Returns null until city Socrata portal is configured
export async function lookupRoofPermit(
  _address: string,
  _city: string
): Promise<{ year: number } | null> {
  return null
}
