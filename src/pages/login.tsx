import { Loader2 } from "lucide-react"
import { Navigate, useLocation, useSearchParams } from "react-router-dom"

import { useSession } from "@/lib/session"

import { AuthFrame, SignInBlock } from "./sign-in-parts"

// Sign in: Google only. Only invited people get in; Google Workspace takes care of the password and the second
// step. When Google sign-in is refused, the backend sends the person back here with the reason (?error=…).

export function LoginPage() {
  const { me, loading } = useSession()
  const [params] = useSearchParams()
  const from = (useLocation().state as { from?: string } | null)?.from
  const next = from && !from.startsWith("/login") && !from.startsWith("/invite") ? from : "/"

  if (loading)
    return (
      <AuthFrame>
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
      </AuthFrame>
    )
  if (me) return <Navigate to={next} replace />

  return (
    <AuthFrame>
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">Sign in to ATM</h1>
        <p className="text-muted-foreground">Use your company Google account. Only people who've been invited can sign in.</p>
      </div>
      <SignInBlock next={next} error={params.get("error")} />
    </AuthFrame>
  )
}
