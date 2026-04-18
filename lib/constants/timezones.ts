const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
]

/**
 * IANA time zones for schedule UI. Uses `Intl.supportedValuesOf` when available (browser / modern Node).
 */
export function listIanaTimeZones(): string[] {
  try {
    const ctor = Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    if (typeof ctor.supportedValuesOf === "function") {
      return ctor.supportedValuesOf("timeZone").slice().sort((a, b) => a.localeCompare(b))
    }
  } catch {
    /* ignore */
  }
  return FALLBACK_TIMEZONES.slice()
}

/** Client default from the user's system (e.g. `America/Los_Angeles`). */
export function getDefaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}
