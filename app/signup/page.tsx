import { AuthForm } from "@/components/app/auth-form"

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <AuthForm defaultMode="signup" />
    </div>
  )
}
