import { SENATE_NOT_UP } from '@/data/states'

export { SENATE_NOT_UP }

/** Days until election day (Eastern Time calendar). */
export function daysToElection(iso: string) {
  const et = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
  return Math.round((Date.parse(iso) - Date.parse(et)) / 86400000)
}
