import { redirect } from "next/navigation"

export default function BrandHubLegacyRedirect() {
  redirect("/assets?tab=brands")
}
