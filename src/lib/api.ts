import { useCallback, useEffect, useRef, useState } from "react"

import { API_URL } from "./config"

// Talks to the backend at VITE_API_URL (.env), for example http://localhost:3000/api/v1.
// The sign-in session is an httpOnly cookie the browser sends by itself; every change carries the client
// header the backend checks against cross-site requests.

const BASE = API_URL

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Fired when the session has ended (signed out elsewhere, deactivated, expired): the app goes to sign-in. */
export const SIGNED_OUT_EVENT = "atm:signed-out"

/**
 * Fired after every successful change (POST, PATCH, PUT). Every screen's data (useApi) reloads quietly, so a
 * change in one card shows everywhere on the page at once: no refresh needed.
 */
export const DATA_CHANGED_EVENT = "atm:data-changed"

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "include",
      headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" ? { "X-ATM-Client": "web" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, "Can't reach the ATM server. Check your connection and try again.")
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
    const raw = data?.message
    const message = Array.isArray(raw) ? raw[0] : typeof raw === "string" ? raw : res.status === 403 ? "Your roles don't allow this." : "Something went wrong. Please try again."
    throw new ApiError(res.status, message)
  }
  // A check (import preview) changes nothing, so it doesn't count.
  if (method !== "GET" && !/\/check$/.test(path)) window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
}

/** Loads `path` (null = nothing yet) and keeps the result; reload() fetches again, setData() updates in place. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(!!path)
  const seq = useRef(0)

  const reload = useCallback(async () => {
    if (!path) return
    const mine = ++seq.current
    setLoading(true)
    try {
      const next = await api.get<T>(path)
      if (mine === seq.current) {
        setData(next)
        setError(undefined)
      }
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [path])

  useEffect(() => {
    void reload()
  }, [reload])

  // Something changed somewhere: load again (once, shortly after, so several changes in a row cost one request).
  useEffect(() => {
    if (!path) return
    let timer: number | undefined
    const onChange = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void reload(), 120)
    }
    window.addEventListener(DATA_CHANGED_EVENT, onChange)
    return () => {
      window.removeEventListener(DATA_CHANGED_EVENT, onChange)
      window.clearTimeout(timer)
    }
  }, [path, reload])

  return { data, error, loading, reload, setData }
}
