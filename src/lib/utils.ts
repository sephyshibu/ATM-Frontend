import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isValidElement, type ReactNode } from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A hard-coded status hex for inline styles (charts, SVG) that follows dark
 * mode: in dark it reads the remapped colour scripts/dark-colors.mjs puts in
 * index.css (--dk-bg-…, --dk-text-…, --dk-border-…); in light it is the hex.
 */
export const themed = (hex: string, use: "bg" | "text" | "border" = "bg") =>
  `var(--dk-${use}-${hex.replace("#", "").toLowerCase()}, ${hex})`

/**
 * The plain text of a node (strings, numbers and the text inside simple
 * elements), or undefined when part of it isn't text. Dialog and drawer
 * subtitles are one line; this is their hover `title`, so a cut-off line can
 * still be read.
 */
export function textOf(node: ReactNode): string | undefined {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) {
    let out = ""
    for (const n of node) {
      const t = textOf(n)
      if (t === undefined) return undefined
      out += t
    }
    return out
  }
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return undefined
}
