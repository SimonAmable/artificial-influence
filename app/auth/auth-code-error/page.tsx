import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function AuthCodeErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>
}) {
  const params = await searchParams
  const error = params?.error
  const errorDescription = params?.error_description

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authentication Error</CardTitle>
          <CardDescription>
            There was a problem signing you in. This could be due to an expired or invalid
            authentication code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="font-medium">Error: {error}</p>
              {errorDescription && (
                <p className="mt-1 text-xs opacity-90">{errorDescription}</p>
              )}
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            <p>Please try signing in again.</p>
            <p className="mt-2 text-xs">
              Make sure Google OAuth is properly configured in your Supabase dashboard.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <Link href="/login">Go to Login</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
