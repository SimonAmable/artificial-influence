import { CronExpressionParser } from "cron-parser"

const DEFAULT_TZ = "UTC"

export type SchedulePresetKind = "hourly" | "daily" | "weekly" | "custom"

/**
 * Six-field cron (seconds first) as used by cron-parser v5.
 * @see https://github.com/harrisiirak/cron-parser
 */
export function validateCronExpression(expression: string, timezone: string): void {
  const tz = timezone?.trim() || DEFAULT_TZ
  CronExpressionParser.parse(expression.trim(), {
    currentDate: new Date(),
    tz,
  })
}

export function computeNextRun(
  expression: string,
  timezone: string,
  from: Date = new Date(),
): Date {
  const tz = timezone?.trim() || DEFAULT_TZ
  const expr = CronExpressionParser.parse(expression.trim(), {
    currentDate: from,
    tz,
  })
  return expr.next().toDate()
}

/** Every hour at minute 0, second 0 */
export const CRON_PRESET_HOURLY = "0 0 * * * *"

/** Daily at local hour/minute in `timezone` */
export function buildDailyCron(minute: number, hour: number): string {
  return `0 ${clamp(minute, 0, 59)} ${clamp(hour, 0, 23)} * * *`
}

/**
 * Weekly on day-of-week (0 = Sunday … 6 = Saturday) at local hour/minute in `timezone`.
 */
export function buildWeeklyCron(dayOfWeek: number, minute: number, hour: number): string {
  return `0 ${clamp(minute, 0, 59)} ${clamp(hour, 0, 23)} * * ${clamp(dayOfWeek, 0, 6)}`
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(n)))
}

export function describeCronHumanSummary(expression: string): string {
  const e = expression.trim()
  if (e === CRON_PRESET_HOURLY) return "Every hour"
  const daily = /^0 (\d{1,2}) (\d{1,2}) \* \* \*$/.exec(e)
  if (daily) {
    return `Daily at ${daily[2].padStart(2, "0")}:${daily[1].padStart(2, "0")} (in your timezone)`
  }
  const weekly = /^0 (\d{1,2}) (\d{1,2}) \* \* ([0-6])$/.exec(e)
  if (weekly) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const dow = Number(weekly[3])
    return `Weekly on ${days[dow] ?? weekly[3]} at ${weekly[2].padStart(2, "0")}:${weekly[1].padStart(2, "0")}`
  }
  return e
}

export type InferredPreset =
  | { kind: "hourly" }
  | { kind: "daily"; minute: number; hour: number }
  | { kind: "weekly"; dayOfWeek: number; minute: number; hour: number }
  | { kind: "custom" }

/** Best-effort parse of 6-field cron back into preset form fields. */
export function inferPresetFromCron(cron: string): InferredPreset {
  const e = cron.trim()
  if (e === CRON_PRESET_HOURLY) {
    return { kind: "hourly" }
  }
  const daily = /^0 (\d{1,2}) (\d{1,2}) \* \* \*$/.exec(e)
  if (daily) {
    return { kind: "daily", minute: Number(daily[1]), hour: Number(daily[2]) }
  }
  const weekly = /^0 (\d{1,2}) (\d{1,2}) \* \* ([0-6])$/.exec(e)
  if (weekly) {
    return {
      kind: "weekly",
      dayOfWeek: Number(weekly[3]),
      minute: Number(weekly[1]),
      hour: Number(weekly[2]),
    }
  }
  return { kind: "custom" }
}
