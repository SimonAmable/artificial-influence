import { redirect } from "next/navigation"

export default function HistoryLegacyRedirect() {
  redirect("/assets?tab=history")
}
