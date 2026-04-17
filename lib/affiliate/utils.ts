/** Commission as decimal (20%). */
export const AFFILIATE_COMMISSION_RATE = 0.2

/** Recurring window after first conversion. */
export const AFFILIATE_COMMISSION_MONTHS = 12

const CODE_REGEX = /^[a-zA-Z0-9]{4,20}$/

export function normalizeAffiliateCode(raw: string): string {
  return raw.trim().toLowerCase()
}

export function validateAffiliateCodeFormat(raw: string): boolean {
  return CODE_REGEX.test(raw.trim())
}

export function addCommissionEligibilityEnd(from: Date): Date {
  const d = new Date(from.getTime())
  d.setMonth(d.getMonth() + AFFILIATE_COMMISSION_MONTHS)
  return d
}
