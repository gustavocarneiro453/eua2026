// Static institutional reference data (not election results).
// House seats: 2020 apportionment (in force for 2026). FIPS: US Census.
export interface StateInfo { code: string; fips: string; name: string; houseSeats: number }

const raw: [string, string, string, number][] = [
  ['AL','01','Alabama',7],['AK','02','Alaska',1],['AZ','04','Arizona',9],['AR','05','Arkansas',4],
  ['CA','06','California',52],['CO','08','Colorado',8],['CT','09','Connecticut',5],['DE','10','Delaware',1],
  ['FL','12','Florida',28],['GA','13','Georgia',14],['HI','15','Hawaii',2],['ID','16','Idaho',2],
  ['IL','17','Illinois',17],['IN','18','Indiana',9],['IA','19','Iowa',4],['KS','20','Kansas',4],
  ['KY','21','Kentucky',6],['LA','22','Louisiana',6],['ME','23','Maine',2],['MD','24','Maryland',8],
  ['MA','25','Massachusetts',9],['MI','26','Michigan',13],['MN','27','Minnesota',8],['MS','28','Mississippi',4],
  ['MO','29','Missouri',8],['MT','30','Montana',2],['NE','31','Nebraska',3],['NV','32','Nevada',4],
  ['NH','33','New Hampshire',2],['NJ','34','New Jersey',12],['NM','35','New Mexico',3],['NY','36','New York',26],
  ['NC','37','North Carolina',14],['ND','38','North Dakota',1],['OH','39','Ohio',15],['OK','40','Oklahoma',5],
  ['OR','41','Oregon',6],['PA','42','Pennsylvania',17],['RI','44','Rhode Island',2],['SC','45','South Carolina',7],
  ['SD','46','South Dakota',1],['TN','47','Tennessee',9],['TX','48','Texas',38],['UT','49','Utah',4],
  ['VT','50','Vermont',1],['VA','51','Virginia',11],['WA','53','Washington',10],['WV','54','West Virginia',2],
  ['WI','55','Wisconsin',8],['WY','56','Wyoming',1],
]

export const STATES: StateInfo[] = raw.map(([code, fips, name, houseSeats]) => ({ code, fips, name, houseSeats }))
export const STATE_BY_CODE = Object.fromEntries(STATES.map((s) => [s.code, s])) as Record<string, StateInfo>
export const STATE_BY_FIPS = Object.fromEntries(STATES.map((s) => [s.fips, s])) as Record<string, StateInfo>

// Senate seats on the 2026 ballot: Class II + special elections (OH, FL).
// heldBy = party holding the seat before the election (Senate.gov).
export interface SenateSeat { state: string; special: boolean; heldBy: 'REP' | 'DEM' }
const R = 'REP' as const, D = 'DEM' as const
export const SENATE_SEATS: SenateSeat[] = [
  ['AL',R],['AK',R],['AR',R],['CO',D],['DE',D],['GA',D],['ID',R],['IL',D],['IA',R],['KS',R],['KY',R],
  ['LA',R],['ME',R],['MA',D],['MI',D],['MN',D],['MS',R],['MT',R],['NE',R],['NH',D],['NJ',D],['NM',D],
  ['NC',R],['OK',R],['OR',D],['RI',D],['SC',R],['SD',R],['TN',R],['TX',R],['VA',D],['WV',R],['WY',R],
].map(([state, heldBy]) => ({ state: state as string, special: false, heldBy: heldBy as 'REP' | 'DEM' }))
  .concat([{ state: 'FL', special: true, heldBy: R }, { state: 'OH', special: true, heldBy: R }])
  .sort((a, b) => a.state.localeCompare(b.state))

// Senate composition before the election: 53 R, 45 D, 2 independents caucusing with Democrats.
export const SENATE = { total: 100, majority: 51, before: { REP: 53, DEM: 45, IND: 2 } }
// Seats NOT on the ballot (carry over): R 53-22 = 31; D+I 47-13 = 34.
export const SENATE_NOT_UP = {
  REP: SENATE.before.REP - SENATE_SEATS.filter((s) => s.heldBy === 'REP').length,
  DEM: SENATE.before.DEM + SENATE.before.IND - SENATE_SEATS.filter((s) => s.heldBy === 'DEM').length,
}
export const HOUSE = { total: 435, majority: 218 }

// Governorships on the 2026 ballot (36 states).
export const GOVERNOR_STATES = ['AL','AK','AZ','AR','CA','CO','CT','FL','GA','HI','ID','IL','IA','KS','ME','MD','MA','MI','MN','NE','NV','NH','NM','NY','OH','OK','OR','PA','RI','SC','SD','TN','TX','VT','WI','WY']

export const ELECTION_DATE = '2026-11-03'

export const STATE_BY_NAME = Object.fromEntries(STATES.map((s) => [s.name, s])) as Record<string, StateInfo>
