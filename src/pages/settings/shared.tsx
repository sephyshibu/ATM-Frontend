import { Eye, Info } from "lucide-react"
import { useState } from "react"

import { showToast } from "@/components/common/toast"
import { TabsContent } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// The pieces every Settings section shares: its card, the read-only note, and a helper that runs a change and
// reports the result as a toast.

/** A section: its tab's panel, headed by its title and a one-line description, with an action on the right. */
export function SectionCard({
  value,
  title,
  description,
  action,
  children,
  canEdit,
  toolbar,
  readOnlyNote = "You can look, but your roles don't allow changes here.",
  lock = true,
}: {
  value: string
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
  /** False: a note says so, and the controls inside are switched off. */
  canEdit: boolean
  /** Search, filter and sort: usable by everyone who can look. */
  toolbar?: React.ReactNode
  readOnlyNote?: string
  /** False: the section hides its own change controls, so browsing (tabs, history, toggles) stays usable. */
  lock?: boolean
}) {
  return (
    <TabsContent value={value} className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>
        {action && canEdit && action}
      </div>
      <div className="flex flex-col gap-5 p-5">
        {!canEdit && (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-muted-foreground">
            <Eye className="mt-0.5 size-4 shrink-0" />
            <span>{readOnlyNote}</span>
          </div>
        )}
        {toolbar}
        <fieldset disabled={!canEdit && lock} className="flex min-w-0 flex-col gap-5">
          {children}
        </fieldset>
      </div>
    </TabsContent>
  )
}

/** A group inside a section: a small heading, a line under it, then its content. */
export function Group({ title, hint, action, children, className }: { title: string; hint?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="font-semibold">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** A short "why" behind an info icon. */
export function Why({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="Why" className="inline-flex text-muted-foreground hover:text-foreground">
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{children}</TooltipContent>
    </Tooltip>
  )
}

/** Runs a change: a success toast when it works, the server's sentence as a warning when it doesn't. */
export async function attempt<T>(run: () => Promise<T>, done?: string | ((r: T) => string)): Promise<T | undefined> {
  try {
    const r = await run()
    if (done) showToast(typeof done === "function" ? done(r) : done)
    return r
  } catch (e) {
    showToast(e instanceof Error ? e.message : String(e), "warning")
    return undefined
  }
}

/** A busy flag around attempt(), for buttons that shouldn't be pressed twice. */
export function useBusy() {
  const [busy, setBusy] = useState(false)
  const run = async <T,>(fn: () => Promise<T>) => {
    setBusy(true)
    try {
      return await fn()
    } finally {
      setBusy(false)
    }
  }
  return [busy, run] as const
}

/** The row of a list that failed to load. */
export function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-4 text-muted-foreground">
      <span>{message}</span>
      <button type="button" onClick={retry} className="font-medium text-primary underline-offset-4 hover:underline">
        Try again
      </button>
    </div>
  )
}

export function Loading() {
  return (
    <div className="flex flex-col gap-2" aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/60" />
      ))}
    </div>
  )
}
