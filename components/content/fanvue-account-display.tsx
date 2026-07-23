import type { FanvueConnectionItem } from "@/components/content/types"

export function fanvueConnectionLabel(connection: FanvueConnectionItem) {
  if (connection.username) return `@${connection.username}`
  return connection.displayName || "Fanvue account"
}

export function fanvueConnectionShortLabel(connection: FanvueConnectionItem) {
  return connection.displayName || fanvueConnectionLabel(connection)
}
