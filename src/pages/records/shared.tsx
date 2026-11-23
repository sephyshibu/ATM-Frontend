import { CircleAlert, CircleCheck } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { dateTimeLabel } from "@/lib/format"
import type { AuditEntry, ListOption, Person } from "@/lib/types"
import { cn } from "@/lib/utils"

// Pieces the Records screens share: a titled card, a label/value row, the archive form, the history list.

export function Card({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Label on the left, value on the right; a dash when empty. */
export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "" || (Array.isArray(children) && !children.length)
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{empty ? <span className="text-muted-foreground">—</span> : children}</dd>
    </div>
  )
}

export function EmailStatus({ status }: { status: Person["emailStatus"] }) {
  if (status === "verified") return <CircleCheck className="size-3.5 shrink-0 text-[#17b26a]" aria-label="Email verified" />
  if (status === "invalid") return <CircleAlert className="size-3.5 shrink-0 text-destructive" aria-label="Email bounced or invalid" />
  return null
}

/** The archive form inside a ⋯ menu: a reason from the list, an optional note. */
export function ArchivePanel({ what, reasons, note, onConfirm, close }: { what: string; reasons: ListOption[]; note?: string; onConfirm: (reasonCode: string, reason: string) => Promise<unknown> | void; close: () => void }) {
  const [code, setCode] = useState("")
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <>
      <p className="font-medium break-words">Archive {what}?</p>
      <p className="text-xs text-muted-foreground">{note ?? "It disappears from lists but nothing is deleted. You can restore it any time."}</p>
      <Select value={code} onValueChange={setCode}>
        <SelectTrigger size="sm" className="w-full bg-card" aria-label="Reason">
          <SelectValue placeholder="Reason" />
        </SelectTrigger>
        <SelectContent>
          {reasons
            .filter((r) => !r.retired)
            .map((r) => (
              <SelectItem key={r.code} value={r.code}>
                {r.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Note (optional)" aria-label="Note" className="min-h-14" />
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={close}>
          Back
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={!code || busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onConfirm(code, text.trim())
              close()
            } finally {
              setBusy(false)
            }
          }}
        >
          Archive
        </Button>
      </div>
    </>
  )
}

/** A record's history from the change log, newest first. */
export function HistoryList({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return <p className="text-muted-foreground">Nothing yet.</p>
  return (
    <ol className="flex flex-col">
      {entries.map((e) => (
        <li key={e.id} className="relative border-l pb-4 pl-4 last:pb-0">
          <span className="absolute top-1.5 -left-[4.5px] size-2 rounded-full bg-border" />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{e.action}</span>
            <span className="text-xs text-muted-foreground">
              {e.actorLabel.replace(/\s*<[^>]*>$/, "")} · {dateTimeLabel(e.at)}
            </span>
          </div>
          {(e.before || e.after) && (
            <div className="mt-1 grid grid-cols-2 gap-3 text-xs">
              <span className="whitespace-pre-wrap text-muted-foreground">{e.before ? e.before : ""}</span>
              <span className="whitespace-pre-wrap">{e.after ?? ""}</span>
            </div>
          )}
          {e.reason && <p className="mt-1 text-xs text-muted-foreground">Why: {e.reason}</p>}
        </li>
      ))}
    </ol>
  )
}

/** The table frame the three lists use. */
export function Table({ columns, head, children }: { columns: string; head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="grid items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: columns }}>
        {head.map((h, i) => (
          <span key={`${h}${i}`}>{h}</span>
        ))}
      </div>
      <ul className="divide-y">{children}</ul>
    </div>
  )
}

export function EmptyList({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-muted-foreground">{children}</p>
}
