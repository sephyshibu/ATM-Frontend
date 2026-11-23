import { useEffect, useState } from "react"

// Light / dark appearance, kept in this browser. Light by default. Applied by toggling the `dark` class on
// <html>; shadcn's tokens and `dark:` variants follow it.

export type ThemeMode = "light" | "dark" | "system"

const KEY = "atm.theme"
const EVENT = "atm:theme"
const media = () => window.matchMedia("(prefers-color-scheme: dark)")

export function loadThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === "dark" || v === "system" ? v : "light"
  } catch {
    return "light"
  }
}

export function applyThemeMode() {
  const mode = loadThemeMode()
  const dark = mode === "dark" || (mode === "system" && media().matches)
  const root = document.documentElement
  root.classList.toggle("dark", dark)
  root.style.colorScheme = dark ? "dark" : "light"
}

export function saveThemeMode(mode: ThemeMode) {
  try {
    if (mode === "light") localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, mode)
  } catch {
    // Storage unavailable: still apply for this visit.
  }
  applyThemeMode()
  window.dispatchEvent(new Event(EVENT))
}

let listening = false

/** Once, at start-up: apply before the first paint and keep in step with the system and other tabs. */
export function initThemeMode() {
  applyThemeMode()
  if (listening) return
  listening = true
  media().addEventListener("change", applyThemeMode)
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === KEY) {
      applyThemeMode()
      window.dispatchEvent(new Event(EVENT))
    }
  })
}

export function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState(loadThemeMode)
  useEffect(() => {
    const update = () => setMode(loadThemeMode())
    window.addEventListener(EVENT, update)
    return () => window.removeEventListener(EVENT, update)
  }, [])
  return [mode, saveThemeMode]
}
