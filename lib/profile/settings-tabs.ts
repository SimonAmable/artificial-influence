import {
  Bell,
  ChatCircleDots,
  Coin,
  HandCoins,
  PawPrint,
  User,
  type Icon,
} from "@phosphor-icons/react"

import { isPresenceProduct } from "@/lib/product/require-presence"

export type SettingsTab =
  | "profile"
  | "notifications"
  | "accounts"
  | "credits"
  | "affiliate"
  | "feedback"
  | "pets"

export type SettingsTabItem = {
  id: SettingsTab
  label: string
  description: string
  icon: Icon
  iconSrc?: string
  searchKeywords: string[]
}

export const SETTINGS_TABS: SettingsTabItem[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Account profile, display name, and preferences",
    icon: User,
    searchKeywords: ["settings", "account", "name", "email", "preferences"],
  },
  {
    id: "accounts",
    label: "Accounts",
    description: "Connected social and publishing accounts",
    icon: User,
    ...(isPresenceProduct() ? { iconSrc: "/brand_icons/fanvue_logo.png" } : {}),
    searchKeywords: ["settings", "connected", "social", "fanvue", "link"],
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Notification preferences and alerts",
    icon: Bell,
    searchKeywords: ["settings", "alerts", "bell", "unread"],
  },
  {
    id: "credits",
    label: "Credits",
    description: "Balance, plans, and buy more credits",
    icon: Coin,
    searchKeywords: ["settings", "billing", "plan", "subscription", "buy", "top up"],
  },
  {
    id: "affiliate",
    label: "Affiliate",
    description: "Affiliate program and referral links",
    icon: HandCoins,
    searchKeywords: ["settings", "referral", "partner", "commission"],
  },
  {
    id: "feedback",
    label: "Feedback",
    description: "Send product feedback and requests",
    icon: ChatCircleDots,
    searchKeywords: ["settings", "support", "request", "report"],
  },
  {
    id: "pets",
    label: "Pets",
    description: "Companion pets and hatch collection",
    icon: PawPrint,
    searchKeywords: ["settings", "hatch", "companion", "pet", "bloop"],
  },
]

export const SETTINGS_TAB_LABELS = Object.fromEntries(
  SETTINGS_TABS.map((tab) => [tab.id, tab.label]),
) as Record<SettingsTab, string>

const SETTINGS_TAB_BY_ID = Object.fromEntries(
  SETTINGS_TABS.map((tab) => [tab.id, tab]),
) as Record<SettingsTab, SettingsTabItem>

export function getSettingsTabItem(tab: SettingsTab): SettingsTabItem {
  return SETTINGS_TAB_BY_ID[tab]
}
