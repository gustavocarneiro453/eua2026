/**
 * Current senators — official U.S. Senate list (XML):
 * https://www.senate.gov/general/contact_information/senators_cfm.xml
 * Verified 2026-11-03: free, no key, no CORS header (read server-side, functions/api/senate.ts).
 * Fields used: first_name, last_name, party (R/D/I), state, class (Class I/II/III), bioguide_id.
 * U.S. government work, public domain.
 */
export interface SenateMember { state: string; senateClass: 1 | 2 | 3; first: string; last: string; party: 'REP' | 'DEM' | 'IND'; bioguide: string }
export interface SenatePayload { api: 1; fetchedAt: string; source: 'senate.gov'; members: SenateMember[] }

export const SENATE_XML = 'https://www.senate.gov/general/contact_information/senators_cfm.xml'
const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" }
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENT[m] ?? m).trim()
const tag = (block: string, name: string) => { const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block); return m ? decode(m[1]) : '' }
const PARTY: Record<string, SenateMember['party']> = { R: 'REP', D: 'DEM', I: 'IND', ID: 'IND' }

export function parseSenateXml(xml: string): SenateMember[] {
  const members: SenateMember[] = []
  for (const m of xml.matchAll(/<member>([\s\S]*?)<\/member>/g)) {
    const b = m[1]
    const cls = /^Class (I{1,3})$/.exec(tag(b, 'class'))
    const party = PARTY[tag(b, 'party')]
    const state = tag(b, 'state')
    if (!cls || !party || !/^[A-Z]{2}$/.test(state)) throw new Error('senate_unexpected_member')
    members.push({ state, senateClass: cls[1].length as 1 | 2 | 3, first: tag(b, 'first_name'), last: tag(b, 'last_name'), party, bioguide: tag(b, 'bioguide_id') })
  }
  // Sanity check: the Senate always has 100 members; anything else means the format changed.
  if (members.length !== 100) throw new Error(`senate_unexpected_count_${members.length}`)
  return members
}

export function validateSenate(raw: any): SenatePayload {
  if (!raw || raw.api !== 1 || raw.source !== 'senate.gov' || !Array.isArray(raw.members) || raw.members.length !== 100 || Number.isNaN(Date.parse(raw.fetchedAt))) throw new Error('invalid_senate_payload')
  return raw as SenatePayload
}
