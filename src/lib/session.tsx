import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { api, ApiError, SIGNED_OUT_EVENT } from "./api"
import type { Me } from "./types"

// The signed-in person for the whole app: loaded once from /auth/me, refreshed after changes that may touch
// their own roles, and cleared when the session ends. Screens hide what the person can't do; the backend checks
// every request again regardless.

type SessionState = {
  me: Me | null
  loading: boolean
  /** Fetch /auth/me again (after signing in, or after changing one's own roles). */
  refresh: () => Promise<Me | null>
  signOut: () => Promise<void>
  can: (...permissions: string[]) => boolean
}

const SessionContext = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const next = await api.get<Me>("/auth/me")
      setMe(next)
      return next
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null)
      else throw e
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => setLoading(false))
    const ended = () => setMe(null)
    window.addEventListener(SIGNED_OUT_EVENT, ended)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, ended)
  }, [refresh])

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout")
    } finally {
      setMe(null)
    }
  }, [])

  const value = useMemo<SessionState>(
    () => ({
      me,
      loading,
      refresh,
      signOut,
      can: (...permissions) => !!me && permissions.every((p) => me.permissions.includes(p)),
    }),
    [me, loading, refresh, signOut],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>.")
  return ctx
}
