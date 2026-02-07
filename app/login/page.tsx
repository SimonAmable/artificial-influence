import { AuthForm } from "@/components/app/auth-form"

type LoginPageProps = {
  searchParams?: {
    mode?: string
  }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const mode = searchParams?.mode === "signup" ? "signup" : "login"

  return <AuthForm defaultMode={mode} />
}
