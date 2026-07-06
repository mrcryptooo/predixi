/**
 * teamAliases — canonical team-name normalization across data providers.
 *
 * API-Football and football-data.org use different display names for the
 * same national team (e.g. "Czech Republic" vs "Czechia"). This is needed to
 * reconcile a football-data.org fixture with an EXISTING API-Football match
 * row that predictions already reference — matching purely on kickoff time
 * is not enough; team names must also resolve to the same canonical key.
 *
 * Verified variants (directly observed in production data from both
 * providers for the same real WC 2026 fixtures):
 */

const ALIAS_GROUPS: string[][] = [
  ['Czech Republic', 'Czechia'],
  ['Cape Verde Islands', 'Cape Verde', 'Cabo Verde'],
  ['Congo DR', 'DR Congo', 'Democratic Republic of Congo', 'DR Kongo'],
  ['IR Iran', 'Iran'],
  ['USA', 'United States', 'United States of America'],
  ['Bosnia & Herzegovina', 'Bosnia-Herzegovina', 'Bosnia and Herzegovina'],
  ['South Korea', 'Korea Republic', 'Republic of Korea'],
  ['Ivory Coast', "Côte d'Ivoire", 'Cote dIvoire'],
]

const CANONICAL_MAP: Map<string, string> = new Map()
for (const group of ALIAS_GROUPS) {
  const canonical = group[0]
  for (const name of group) {
    CANONICAL_MAP.set(normalizeRaw(name), canonical)
  }
}

/** Lowercase, trim, strip diacritics and punctuation noise — first pass before alias lookup. */
function normalizeRaw(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // strip punctuation (&, -, ', .)
    .replace(/\s+/g, ' ')
}

/** Returns the canonical team name key for cross-provider matching. */
export function canonicalTeamName(name: string): string {
  const normalized = normalizeRaw(name)
  return CANONICAL_MAP.get(normalized) ?? normalized
}

/** True when two team names (possibly from different providers) refer to the same team. */
export function isSameTeam(a: string, b: string): boolean {
  return canonicalTeamName(a) === canonicalTeamName(b)
}
