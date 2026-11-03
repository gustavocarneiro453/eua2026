/**
 * Official election websites for states WITHOUT a machine-readable results feed in Open America
 * (the 28 states outside its 22-state coverage). Used only as outbound links, never as data.
 * 20 URLs come from Open America's own "no live feed" links; the other 8 (CA, HI, MD, MO, NV, NY, ND, WI)
 * are the states' official election offices. Checked 2026-11-03: most answered 200; a few official
 * sites answer 403 to automated clients (OH, NH, TN, ME, NY, WI) and Alaska did not respond from the
 * build environment, so those could not be verified automatically.
 */
export const STATE_OFFICES: Record<string, { name: string; url: string }> = {
  AL: { name: 'Alabama Secretary of State', url: 'https://www.sos.alabama.gov/alabama-votes' },
  AK: { name: 'Alaska Division of Elections', url: 'https://www.elections.alaska.gov/' },
  CA: { name: 'California Secretary of State', url: 'https://www.sos.ca.gov/elections' },
  DE: { name: 'Delaware Department of Elections', url: 'https://elections.delaware.gov/index.shtml' },
  HI: { name: 'Hawaii Office of Elections', url: 'https://elections.hawaii.gov/' },
  IL: { name: 'Illinois State Board of Elections', url: 'https://www.elections.il.gov/' },
  KS: { name: 'Kansas Secretary of State', url: 'https://sos.ks.gov/elections/elections.html' },
  KY: { name: 'Kentucky State Board of Elections', url: 'https://elect.ky.gov/Pages/default.aspx' },
  ME: { name: 'Maine Secretary of State', url: 'https://www.maine.gov/sos/cec/elec/' },
  MD: { name: 'Maryland State Board of Elections', url: 'https://elections.maryland.gov/' },
  MA: { name: 'Massachusetts Elections Division', url: 'https://www.sec.state.ma.us/ele/eleidx.htm' },
  MS: { name: 'Mississippi Secretary of State', url: 'https://www.sos.ms.gov/elections-voting/voter-registration-information' },
  MO: { name: 'Missouri Secretary of State', url: 'https://www.sos.mo.gov/elections' },
  MT: { name: 'Montana Secretary of State', url: 'https://votemt.gov/' },
  NE: { name: 'Nebraska Secretary of State', url: 'https://sos.nebraska.gov/elections' },
  NV: { name: 'Nevada Secretary of State', url: 'https://www.nvsos.gov/sos/elections' },
  NH: { name: 'New Hampshire Secretary of State', url: 'https://sos.nh.gov/home' },
  NJ: { name: 'New Jersey Division of Elections', url: 'https://www.state.nj.us/state/elections/index.shtml' },
  NM: { name: 'New Mexico Secretary of State', url: 'https://www.sos.state.nm.us/voting-and-elections/' },
  NY: { name: 'New York State Board of Elections', url: 'https://www.elections.ny.gov/' },
  ND: { name: 'North Dakota Secretary of State', url: 'https://vip.sos.nd.gov/' },
  OH: { name: 'Ohio Secretary of State', url: 'https://www.sos.state.oh.us/elections/' },
  OK: { name: 'Oklahoma State Election Board', url: 'https://www.ok.gov/elections/' },
  OR: { name: 'Oregon Secretary of State', url: 'https://sos.oregon.gov/voting-elections/Pages/default.aspx' },
  SD: { name: 'South Dakota Secretary of State', url: 'https://sdsos.gov/elections-voting/' },
  TN: { name: 'Tennessee Secretary of State', url: 'https://sos.tn.gov/elections' },
  WI: { name: 'Wisconsin Elections Commission', url: 'https://elections.wi.gov/' },
  WY: { name: 'Wyoming Secretary of State', url: 'https://sos.wyo.gov/elections/state/registeringtovote.aspx' },
}
