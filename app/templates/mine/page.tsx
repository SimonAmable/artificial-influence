import { redirect } from "next/navigation"

export const metadata = {
  title: "My Templates",
}

export default async function MyTemplatesPage() {
  redirect("/templates")
}
