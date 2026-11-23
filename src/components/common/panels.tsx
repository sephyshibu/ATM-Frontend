// Confirm / delete / note panels, opened from a ⋯ menu entry (a popover on desktop, a drawer on phones).

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "./form"

/** A confirmation inside a menu panel. */
export function ConfirmPanel({ title, body, confirm, destructive, onConfirm, close, children }: { title: string; body?: React.ReactNode; confirm: string; destructive?: boolean; onConfirm: () => void; close: () => void; children?: React.ReactNode }) {
  return (
    <>
      <p className="font-medium break-words">{title}</p>
      {body && <p className="text-xs leading-relaxed break-words text-muted-foreground">{body}</p>}
      {children}
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={close}>
          Back
        </Button>
        <Button
          size="sm"
          variant={destructive ? "destructive" : "default"}
          onClick={() => {
            onConfirm()
            close()
          }}
        >
          {confirm}
        </Button>
      </div>
    </>
  )
}

/** Delete, or say why it can't be. */
export function DeletePanel({ what, blocker, body, onDelete, close }: { what: string; blocker?: string; body?: string; onDelete: () => void; close: () => void }) {
  if (blocker)
    return (
      <>
        <p className="font-medium break-words">{what} can't be deleted</p>
        <p className="text-xs leading-relaxed break-words text-muted-foreground">{blocker}</p>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={close}>
            OK
          </Button>
        </div>
      </>
    )
  return <ConfirmPanel title={`Delete ${what}?`} body={body ?? "It goes for good."} confirm="Delete" destructive onConfirm={onDelete} close={close} />
}

/** A note (optional or required) before an action: cancel, reject. */
export function NotePanel({ title, placeholder, confirm, destructive, required, onConfirm, close }: { title: string; placeholder: string; confirm: string; destructive?: boolean; required?: boolean; onConfirm: (note: string) => void; close: () => void }) {
  const [note, setNote] = useState("")
  return (
    <>
      <p className="font-medium break-words">{title}</p>
      <Textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={placeholder} aria-label={title} className="min-h-16" />
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={close}>
          Back
        </Button>
        <Button
          size="sm"
          variant={destructive ? "destructive" : "default"}
          disabled={required && !note.trim()}
          onClick={() => {
            onConfirm(note.trim())
            close()
          }}
        >
          {confirm}
        </Button>
      </div>
    </>
  )
}

/** A number and a note: add stock, add units, count the shelf. */
export function QtyNotePanel({ title, qtyLabel, initial = "", initialNote = "", min = 0, max, placeholder, confirm, onConfirm, close, valid, body }: { title: string; qtyLabel: string; initial?: string; initialNote?: string; min?: number; max?: number; placeholder: string; confirm: string; onConfirm: (n: number, note: string) => void; close: () => void; valid?: (n: number) => boolean; /** A muted line under the title, for this quantity (what it means). */ body?: (n: number) => React.ReactNode }) {
  const [qty, setQty] = useState(initial)
  const [note, setNote] = useState(initialNote)
  const n = Math.round(Number(qty))
  const ok = qty !== "" && Number.isFinite(n) && n >= min && (max === undefined || n <= max) && (!valid || valid(n))
  return (
    <>
      <p className="font-medium break-words">{title}</p>
      {body?.(n) && <p className="text-xs leading-relaxed break-words text-muted-foreground">{body(n)}</p>}
      <Field label={qtyLabel}>
        <Input autoFocus type="number" min={min} max={max} value={qty} onChange={(e) => setQty(e.target.value)} className="h-8 text-foreground tabular-nums" />
      </Field>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={placeholder} aria-label="Note" className="min-h-16" />
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={close}>
          Back
        </Button>
        <Button
          size="sm"
          disabled={!ok}
          onClick={() => {
            onConfirm(n, note.trim())
            close()
          }}
        >
          {confirm}
        </Button>
      </div>
    </>
  )
}
