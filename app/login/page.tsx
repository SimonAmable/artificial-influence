import { AuthForm } from "@/components/app/auth-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <AuthForm defaultMode="login" />
    </div>
  )
}
