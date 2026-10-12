import type { EarningsBriefingNote, EarningsCompany, EarningsSession } from "./scanner";

export const EARNINGS_MARKET_CAP_FLOOR = 25_000_000_000;

/** A row is eligible only when its USD market cap and observation date are recorded. */
export function isEligibleEarningsCompany(company: EarningsCompany): boolean {
  return Number.isFinite(company.marketCap)
    && company.marketCap !== null
    && company.marketCap > EARNINGS_MARKET_CAP_FLOOR
    && Boolean(company.marketCapAsOf && company.marketCapUrl && company.marketCapSource);
}

export function eligibleEarningsSessions(note: EarningsBriefingNote): EarningsSession[] {
  return (note.sessions ?? [])
    .map((session) => ({
      ...session,
      companies: session.companies.filter(isEligibleEarningsCompany),
    }))
    .filter((session) => session.companies.length > 0);
}

export function hasStructuredEarnings(notes: EarningsBriefingNote[]): boolean {
  return notes.some((note) => Array.isArray(note.sessions));
}
