import { Loader2 } from "lucide-react"
import { Navigate, Outlet, useLocation } from "react-router-dom"

import { Toaster } from "@/components/common/toast"
import { useSession } from "@/lib/session"
import type { Me } from "@/lib/types"

import { AppHeader } from "./app-header"

/** The first area this person can open: Records, then Settings. */
export function homeFor(me: Me | null) {
  if (me?.permissions.includes("records.view")) return "/records"
  if (me?.permissions.includes("settings.view")) return "/settings"
  return "/no-access"
}

/** Signed-in pages: the header, the page, the one toast. Signed out goes to sign-in, then back. */
export function AppLayout() {
  const { me, loading } = useSession()
  const { pathname, search } = useLocation()
  if (loading)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  if (!me) return <Navigate to="/login" replace state={{ from: `${pathname}${search}` }} />
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader me={me} area={pathname.startsWith("/leads") ? "Leads" : pathname.startsWith("/records") ? "Records" : pathname.startsWith("/settings") ? "Settings" : "ATM"} home={homeFor(me)} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-6">
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}

/** "/": straight to the person's home area. */
export function Home() {
  const { me } = useSession()
  return <Navigate to={homeFor(me)} replace />
}
