import { redirect } from "next/navigation"

/** Legacy URL: kit creation now uses real IDs from `/brand` (New kit dialog). */
export default function BrandNewLegacyRedirect() {
  redirect("/brand")
}
