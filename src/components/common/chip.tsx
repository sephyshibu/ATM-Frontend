// A status chip: a rounded badge with a dot, in a tint from ./tones (or a module's own styles).

import { cn } from "@/lib/utils"
import type { Tone } from "./tones"

/**
 * The app's standard tag size (the compact Low stock tag): 18px tall on one line, 11px text, 6px side padding.
 * Every tag, chip and pill uses it (Chip, Badge, and hand-made tags spread it into their classes); a tag that
 * wraps grows a line at a time (min height, 14px lines).
 */
export const TAG_SIZE = "min-h-[18px] gap-1 px-1.5 py-px text-[11px] leading-[14px]"

/** The customer app's tag (`pages/mobile`, read on a phone): the same 18px box with 12px text (Badge `size="md"`). */
export const TAG_SIZE_MD = "min-h-[18px] gap-1 px-1.5 py-px text-xs leading-[14px]"

/** Small (`TAG_SIZE`) by default; `size="md"` is the customer app's 12px text in the same box (`TAG_SIZE_MD`). */
export function Chip({ tone, children, className, size = "sm" }: { tone: Tone; children: React.ReactNode; className?: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("inline-flex w-fit items-center rounded-full border font-medium whitespace-nowrap", size === "md" ? TAG_SIZE_MD : TAG_SIZE, tone.badge, className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
      {children}
    </span>
  )
}
