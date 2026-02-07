"use client"

import * as React from "react"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeftIcon, EnvelopeSimpleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type AuthMode = "login" | "signup"

type ShowcaseItem = {
  id: string
  media: {
    type: "image" | "video"
    src: string
  }
}

const SHOWCASE_DURATION_MS = 7000

const showcaseItems: ShowcaseItem[] = [
  {
    id: "image-generation",
    media: {
      type: "image",
      src: "/hero_showcase_images/influencer_generation_showcase.png",
    },
  },
  {
    id: "kling-2-6-motion-control",
    media: {
      type: "video",
      src: "/hero_showcase_images/motion_copy.mp4",
    },
  },
  {
    id: "banana-banano-pro-image-editing",
    media: {
      type: "image",
      src: "/hero_showcase_images/image_editing_wide.png",
    },
  },
]

export function AuthForm({ defaultMode = "login" }: { defaultMode?: AuthMode }) {
  const [mode, setMode] = React.useState<AuthMode>(defaultMode)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [googleLoading, setGoogleLoading] = React.useState(false)
  const [showEmailForm, setShowEmailForm] = React.useState(defaultMode === "signup")
  const [activeShowcase, setActiveShowcase] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = createClient()

  React.useEffect(() => {
    setMode(defaultMode)
    setShowEmailForm(defaultMode === "signup")
    setError(null)
    setMessage(null)
  }, [defaultMode])

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setActiveShowcase((current) => (current + 1) % showcaseItems.length)
    }, SHOWCASE_DURATION_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [activeShowcase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.warning("Please enter both email and password.")
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    const loadingToast =
      mode === "login"
        ? toast.loading("Signing you in...")
        : toast.loading("Creating your account...")

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (signUpError) throw signUpError

        toast.dismiss(loadingToast)
        const successMessage = "Check your email to confirm your account."
        setMessage(successMessage)
        toast.success(successMessage)
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) throw signInError

        toast.dismiss(loadingToast)
        toast.success("Logged in successfully.")
        router.push("/")
        router.refresh()
      }
    } catch (err: unknown) {
      toast.dismiss(loadingToast)
      const errorMessage = err instanceof Error ? err.message : "An error occurred"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    const nextMode: AuthMode = mode === "login" ? "signup" : "login"
    const params = new URLSearchParams(searchParams.toString())

    if (nextMode === "signup") {
      params.set("mode", "signup")
    } else {
      params.delete("mode")
    }

    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname)

    setMode(nextMode)
    setShowEmailForm(true)
    setError(null)
    setMessage(null)
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError(null)
    setMessage(null)

    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      })

      if (signInError) {
        throw signInError
      }

      if (data?.url) {
        toast.info("Redirecting to Google...")
        window.location.href = data.url
      } else {
        throw new Error("No redirect URL returned from OAuth")
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sign in with Google"
      setError(errorMessage)
      toast.error(errorMessage)
      setGoogleLoading(false)
    }
  }

  const handleBack = () => {
    if (showEmailForm) {
      setShowEmailForm(false)
      return
    }

    router.back()
  }

  const activeItem = showcaseItems[activeShowcase]

  return (
    <main className="h-svh overflow-hidden bg-[#060a0f] pt-14 text-white">
      <div className="mx-auto grid h-full w-full max-w-[1800px] grid-cols-1 lg:grid-cols-2">
        <section className="flex items-center justify-center px-4 py-6 sm:px-6">
          <div className="flex w-full max-w-md flex-col">
            <div className="space-y-7">
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Image src="logo.svg" alt="Logo" width={32} height={32} />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight ">
                    {mode === "login" ? "Log in to" : "Sign up for"} Artificial Influencer
                  </h1>
                  <p className="text-base text-white/65">Sign in to continue</p>
                </div>
              </div>

              {!showEmailForm && (
                <div className="hidden space-y-3 lg:block">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 w-full justify-center rounded-xl border-white/15 bg-white/[0.02] text-base text-white hover:bg-white/[0.06]"
                    onClick={handleGoogleSignIn}
                    disabled={loading || googleLoading}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    {googleLoading ? "Loading..." : "Continue with Google"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 w-full justify-center rounded-xl border-white/15 bg-white/[0.02] text-base text-white hover:bg-white/[0.06]"
                    onClick={() => setShowEmailForm(true)}
                    disabled={loading || googleLoading}
                  >
                    <EnvelopeSimpleIcon className="mr-2 size-4" />
                    Continue with Email
                  </Button>
                </div>
              )}

              <form onSubmit={handleSubmit} className={cn("space-y-3", !showEmailForm && "lg:hidden")}>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  className="h-14 rounded-xl border-white/15 bg-white/[0.02] text-base text-white placeholder:text-white/55 focus-visible:ring-primary/60"
                />
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  minLength={6}
                  className="h-14 rounded-xl border-white/15 bg-white/[0.02] text-base text-white placeholder:text-white/55 focus-visible:ring-primary/60"
                />

                {error && (
                  <p className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                    {error}
                  </p>
                )}

                {message && (
                  <p className="rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 text-sm text-primary">
                    {message}
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-14 w-full rounded-xl bg-white/[0.08] text-2xl font-semibold text-white hover:bg-white/[0.14]"
                  disabled={loading || googleLoading}
                >
                  {loading ? "Loading..." : mode === "login" ? "Log in" : "Sign up"}
                </Button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-white/80 hover:text-white"
                  >
                    <ArrowLeftIcon className="size-4" />
                    Back
                  </button>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => toast.info("Enter your email to receive a reset link.")}
                      className="text-sm font-semibold text-white/80 hover:text-white"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
              </form>

              <p className="text-center text-xl text-white/85">
                {mode === "login" ? "Don\'t have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="font-semibold text-white underline underline-offset-4 hover:text-primary"
                >
                  {mode === "login" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </div>

            <p className="mt-16 text-center text-xs text-white/55 sm:mt-24">
              By continuing, I acknowledge the
              {" "}
              <a href="#" className="underline underline-offset-2 hover:text-white">
                Privacy Policy
              </a>
              {" "}
              and agree to the
              {" "}
              <a href="#" className="underline underline-offset-2 hover:text-white">
                Terms of Use
              </a>
              . I also confirm that I am at least 18 years old.
            </p>
          </div>
        </section>

        <section className="hidden py-3 pr-3 pl-1 lg:flex lg:items-center lg:justify-center">
          <div className="relative h-[calc(100vh-5rem)] w-full max-h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-white/10 bg-black">
            {activeItem.media.type === "image" ? (
              <Image
                src={activeItem.media.src}
                alt="Showcase media"
                fill
                className="object-cover"
                priority
              />
            ) : (
              <video
                key={activeItem.media.src}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              >
                <source src={activeItem.media.src} type="video/mp4" />
              </video>
            )}

            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-6">
              <div className="flex items-center gap-2">
                {showcaseItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveShowcase(index)}
                    aria-label={`Go to slide ${index + 1}`}
                    className="group relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/20 transition hover:bg-white/30"
                  >
                    {index === activeShowcase ? (
                      <span
                        key={`progress-${index}-${activeShowcase}`}
                        className="absolute inset-y-0 left-0 rounded-full bg-primary"
                        style={{
                          animation: `showcase-progress ${SHOWCASE_DURATION_MS}ms linear forwards`,
                        }}
                      />
                    ) : (
                      <span className="absolute inset-y-0 left-0 w-0 rounded-full bg-primary/70" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
      <style jsx>{`
        @keyframes showcase-progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </main>
  )
}
