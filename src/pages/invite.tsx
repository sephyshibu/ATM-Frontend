import { Clock, Loader2, MailX } from "lucide-react"
import { Link, Navigate, useParams } from "react-router-dom"

import { PersonAvatar } from "@/components/common/person-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useApi } from "@/lib/api"
import { dateLabel } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { InviteInfo } from "@/lib/types"

import { AuthFrame, ErrorNote, SignInBlock } from "./sign-in-parts"

// The invite link from the email: who invited whom, as what, then Google sign-in for that email. Signing in for
// the first time turns the invite into an active account.

export function InvitePage() {
  const { token = "" } = useParams()
  const { me } = useSession()
  const invite = useApi<InviteInfo>(`/auth/invite/${encodeURIComponent(token)}`)

  if (me) return <Navigate to="/" replace />

  return (
    <AuthFrame>
      {invite.loading ? (
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
      ) : invite.error ? (
        <ErrorNote>{invite.error}</ErrorNote>
      ) : invite.data?.valid ? (
        <>
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-[-0.02em]">You're invited, {invite.data.name.split(/\s+/)[0]}</h1>
            <p className="text-muted-foreground">{invite.data.invitedBy} invited you to the ATM CRM. Sign in with the Google account for this email to accept.</p>
          </div>
          <div className="mb-6 flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <PersonAvatar name={invite.data.name} className="size-9" />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex flex-col">
                <span className="font-medium">{invite.data.name}</span>
                <span className="text-xs break-all text-muted-foreground">{invite.data.email}</span>
              </span>
              <span className="flex flex-wrap gap-1">
                {invite.data.roles.length ? (
                  invite.data.roles.map((r) => (
                    <Badge key={r} variant="secondary" className="bg-accent text-accent-foreground">
                      {r}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No role yet: you can sign in, but nothing opens until you get one.</span>
                )}
              </span>
              {invite.data.expiresAt && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" /> Valid until {dateLabel(invite.data.expiresAt)}
                </span>
              )}
            </span>
          </div>
          <SignInBlock loginHint={invite.data.email} next="/" />
        </>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <MailX className="size-6" />
          </span>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">{invite.data?.reason === "expired" ? "This invite has expired" : "This invite link doesn't work any more"}</h1>
          <p className="text-muted-foreground">
            {invite.data?.reason === "expired"
              ? "Ask the person who invited you to send it again. The new email has a fresh link."
              : "It was used already, replaced by a newer invite, or cancelled. If you've accepted before, just sign in."}
          </p>
          <Button asChild variant="outline">
            <Link to="/login">Go to sign-in</Link>
          </Button>
        </div>
      )}
    </AuthFrame>
  )
}
