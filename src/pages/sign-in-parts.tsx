import { CircleAlert, Loader2 } from "lucide-react"
import { useState } from "react"

import { LogoMark } from "@/components/brand/logo"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useApi } from "@/lib/api"
import { googleSignInUrl } from "@/lib/google"
import type { AuthConfig } from "@/lib/types"

// The pieces the sign-in and invite pages share: the brand panel, the page frame, and the Google button.

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden border-r bg-brand-50 lg:flex lg:flex-col lg:px-12 lg:py-10 dark:bg-brand-950/30">
      <div className="relative my-auto flex max-w-[380px] flex-col gap-5">
        <LogoMark className="size-14" />
        <div className="flex flex-col gap-2">
          <p className="text-2xl font-semibold tracking-[-0.02em] text-foreground">ATM CRM</p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">One brand record from first touch to a signed contract. The first module of iTradeHub.</p>
        </div>
      </div>
      <p className="relative text-xs text-muted-foreground">Invite only · sign in with your company Google account</p>
    </aside>
  )
}

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <BrandPanel />
      <div className="flex min-w-0 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark className="size-9" />
            <span className="text-base font-semibold tracking-[-0.02em]">ATM</span>
          </div>
          {children}
        </div>
      </div>
    </main>
  )
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <Alert variant="destructive" className="bg-destructive/5">
      <CircleAlert />
      <AlertTitle className="line-clamp-none whitespace-normal">{children}</AlertTitle>
    </Alert>
  )
}

/** Google's "G", in its own colours. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-[18px]">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/** The "Sign in with Google" button: off to Google's own sign-in page, then back to `next`. */
export function SignInBlock({ next = "/", loginHint, error }: { next?: string; loginHint?: string; error?: string | null }) {
  const config = useApi<AuthConfig>("/auth/config")
  const [leaving, setLeaving] = useState(false)
  const domain = config.data?.allowedDomains.length === 1 ? config.data.allowedDomains[0] : undefined

  if (config.loading) return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
  if (config.error) return <ErrorNote>{config.error}</ErrorNote>

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorNote>{error}</ErrorNote>}
      {config.data?.googleConfigured ? (
        <Button asChild variant="outline" size="lg" className="h-11 w-full gap-3 bg-card text-[14px] font-medium">
          <a href={googleSignInUrl(next, loginHint)} onClick={() => setLeaving(true)} aria-disabled={leaving}>
            {leaving ? <Loader2 className="animate-spin" /> : <GoogleMark />}
            {leaving ? "Opening Google…" : "Sign in with Google"}
          </a>
        </Button>
      ) : (
        <ErrorNote>Google sign-in isn't set up on this server yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the backend's .env and restart it.</ErrorNote>
      )}
      {domain && <p className="text-center text-xs text-muted-foreground">Use your @{domain} account.</p>}
    </div>
  )
}
