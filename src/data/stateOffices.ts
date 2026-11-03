/**
 * Official election websites for states WITHOUT a machine-readable results feed in Open America
 * (the 28 states outside its 22-state coverage). Used only as outbound links, never as data.
 * 20 URLs come from Open America's own "no live feed" links; the other 8 (CA, HI, MD, MO, NV, NY, ND, WI)
 * are the states' official election offices. Checked 2026-11-03: most answered 200; a few official
 * sites answer 403 to automated clients (OH, NH, TN, ME, NY, WI) and Alaska did not respond from the
 * build environment, so those could not be verified automatically.
 */
/** `url` = the election office; `results` = its official results portal when one is known (`resultsVerified` = it answered 2xx to an automated check on 2026-11-03). */
export interface StateOffice { name: string; url: string; results?: string; resultsVerified?: boolean }
export const STATE_OFFICES: Record<string, StateOffice> = {
  AL: { name: 'Alabama Secretary of State', url: 'https://www.sos.alabama.gov/alabama-votes' },
  AK: { name: 'Alaska Division of Elections', url: 'https://www.elections.alaska.gov/' },
  CA: { name: 'California Secretary of State', url: 'https://www.sos.ca.gov/elections', results: 'https://electionresults.sos.ca.gov/', resultsVerified: true },
  DE: { name: 'Delaware Department of Elections', url: 'https://elections.delaware.gov/index.shtml', results: 'https://elections.delaware.gov/results/', resultsVerified: true },
  HI: { name: 'Hawaii Office of Elections', url: 'https://elections.hawaii.gov/', results: 'https://elections.hawaii.gov/election-results/', resultsVerified: true },
  IL: { name: 'Illinois State Board of Elections', url: 'https://www.elections.il.gov/', results: 'https://elections.il.gov/ElectionOperations/ElectionVoteTotals.aspx', resultsVerified: true },
  KS: { name: 'Kansas Secretary of State', url: 'https://sos.ks.gov/elections/elections.html', results: 'https://sos.ks.gov/elections/election-results.html', resultsVerified: true },
  KY: { name: 'Kentucky State Board of Elections', url: 'https://elect.ky.gov/Pages/default.aspx' },
  ME: { name: 'Maine Secretary of State', url: 'https://www.maine.gov/sos/cec/elec/', results: 'https://www.maine.gov/sos/elections-voting/election-results-data', resultsVerified: true },
  MD: { name: 'Maryland State Board of Elections', url: 'https://elections.maryland.gov/', results: 'https://elections.maryland.gov/elections/results.html', resultsVerified: true },
  MA: { name: 'Massachusetts Elections Division', url: 'https://www.sec.state.ma.us/ele/eleidx.htm', results: 'https://electionstats.state.ma.us/', resultsVerified: true },
  MS: { name: 'Mississippi Secretary of State', url: 'https://www.sos.ms.gov/elections-voting/voter-registration-information', results: 'https://www.sos.ms.gov/elections-voting/election-results', resultsVerified: true },
  MO: { name: 'Missouri Secretary of State', url: 'https://www.sos.mo.gov/elections', results: 'https://enr.sos.mo.gov/' },
  MT: { name: 'Montana Secretary of State', url: 'https://votemt.gov/', results: 'https://sosmt.gov/elections/results/', resultsVerified: true },
  NE: { name: 'Nebraska Secretary of State', url: 'https://sos.nebraska.gov/elections', results: 'https://electionresults.nebraska.gov/', resultsVerified: true },
  NV: { name: 'Nevada Secretary of State', url: 'https://www.nvsos.gov/sos/elections', results: 'https://silverstateelection.nv.gov/', resultsVerified: true },
  NH: { name: 'New Hampshire Secretary of State', url: 'https://sos.nh.gov/home' },
  NJ: { name: 'New Jersey Division of Elections', url: 'https://www.state.nj.us/state/elections/index.shtml', results: 'https://www.nj.gov/state/elections/election-information-results.shtml', resultsVerified: true },
  NM: { name: 'New Mexico Secretary of State', url: 'https://www.sos.state.nm.us/voting-and-elections/', results: 'https://electionresults.sos.nm.gov/', resultsVerified: true },
  NY: { name: 'New York State Board of Elections', url: 'https://www.elections.ny.gov/' },
  ND: { name: 'North Dakota Secretary of State', url: 'https://vip.sos.nd.gov/', results: 'https://results.sos.nd.gov/', resultsVerified: true },
  OH: { name: 'Ohio Secretary of State', url: 'https://www.sos.state.oh.us/elections/', results: 'https://liveresults.ohiosos.gov/' },
  OK: { name: 'Oklahoma State Election Board', url: 'https://www.ok.gov/elections/', results: 'https://results.okelections.us/' },
  OR: { name: 'Oregon Secretary of State', url: 'https://sos.oregon.gov/voting-elections/Pages/default.aspx', results: 'https://results.oregonvotes.gov/', resultsVerified: true },
  SD: { name: 'South Dakota Secretary of State', url: 'https://sdsos.gov/elections-voting/', results: 'https://electionresults.sd.gov/', resultsVerified: true },
  TN: { name: 'Tennessee Secretary of State', url: 'https://sos.tn.gov/elections', results: 'https://sos.tn.gov/elections/results', resultsVerified: true },
  WI: { name: 'Wisconsin Elections Commission', url: 'https://elections.wi.gov/', results: 'https://elections.wi.gov/elections-voting/results' },
  WY: { name: 'Wyoming Secretary of State', url: 'https://sos.wyo.gov/elections/state/registeringtovote.aspx' },
}
