import { cn } from "@/lib/utils"

// ATM's mark (a placeholder until the real logo is supplied) and the app's name beside it.

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M9 23 16 8l7 15h-4l-3-7-3 7z" fill="#fff" />
    </svg>
  )
}

export function Logo({ area }: { area?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <LogoMark />
      <span className="text-lg font-semibold tracking-[-0.02em] text-foreground">ATM</span>
      {area && (
        <>
          <span aria-hidden className="h-5 w-px bg-border" />
          <span className="text-lg font-semibold tracking-[-0.02em] text-foreground">{area}</span>
        </>
      )}
    </span>
  )
}
