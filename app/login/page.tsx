import { Suspense } from "react"
import { AuthForm } from "@/components/app/auth-form"

type LoginPageProps = {
  searchParams: Promise<{
    mode?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const mode = params?.mode === "signup" ? "signup" : "login"

  return (
    <Suspense fallback={null}>
      <AuthForm defaultMode={mode} />
    </Suspense>
  )
}
