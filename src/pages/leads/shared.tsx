import { useState } from "react"

import { Chip } from "@/components/common/chip"
import { Field } from "@/components/common/form"
import { AMBER, BLUE, GREEN, GREY, MUTED, RED, TEAL, VIOLET, type Tone } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Journey, RecordOptions } from "@/lib/types"

// Pieces the lead screens share: the stage chip, and the small forms a move, an override or an undo needs.

const STAGE_TONES: Record<string, Tone> = { register: GREY, target: BLUE, contacted: VIOLET, warm: AMBER, hot: RED, sql: GREEN }
const LANE_TONES: Record<string, Tone> = { nurture: TEAL, watch: TEAL, verification_pending: AMBER, parked: MUTED, on_hold: MUTED, rested: MUTED, not_pursued: MUTED, disqualified: MUTED, suppressed: MUTED, closed_enquiry: MUTED }

export function StageChip({ lead }: { lead: { stage: string; lane: string | null; position: string } }) {
  return <Chip tone={lead.lane ? (LANE_TONES[lead.lane] ?? MUTED) : (STAGE_TONES[lead.stage] ?? GREY)}>{lead.position}</Chip>
}

export function FlagChips({ labels }: { labels: string[] }) {
  if (!labels.length) return null
  return (
    <span className="flex flex-wrap gap-1">
      {labels.map((f) => (
        <Chip key={f} tone={AMBER}>
          {f}
        </Chip>
      ))}
    </span>
  )
}

const today = () => new Date().toISOString().slice(0, 10)

export type MoveInput = { reasonCode?: string; reason?: string; until?: string }

/** What a move needs before it goes: a reason from a list, a written reason, a date. */
export function MoveDialog({
  open,
  title,
  help,
  to,
  ends,
  reasonList,
  reasonRequired,
  untilRequired,
  warnings,
  options,
  count,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  help: string
  to: string
  ends?: boolean
  reasonList?: string | null
  reasonRequired?: boolean
  untilRequired?: boolean
  warnings?: string[]
  options?: RecordOptions
  /** For bulk moves: how many leads. */
  count?: number
  onClose: () => void
  onConfirm: (input: MoveInput) => Promise<boolean>
}) {
  const [reasonCode, setReasonCode] = useState("")
  const [reason, setReason] = useState("")
  const [until, setUntil] = useState("")
  const [busy, setBusy] = useState(false)
  const reasons = reasonList ? (options?.lists[reasonList as keyof RecordOptions["lists"]] ?? []).filter((r) => !r.retired) : []
  const missing = (reasonList && !reasonCode) || (reasonRequired && !reason.trim()) || (untilRequired && !until)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-[460px]">
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <DialogTitle>
            {title}
            {count && count > 1 ? ` · ${count} leads` : ""}
          </DialogTitle>
          <DialogDescription>
            {help} Moves to <span className="font-medium text-foreground">{to}</span>.
          </DialogDescription>
        </div>
        <div className="flex flex-col gap-3 px-6 py-5">
          {warnings?.map((w) => (
            <p key={w} className="rounded-md border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-xs text-[#93370d]">
              {w}
            </p>
          ))}
          {reasonList && (
            <Field label="Reason">
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger size="sm" className="w-full bg-card text-foreground" aria-label="Reason">
                  <SelectValue placeholder="Pick a reason" />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {untilRequired && (
            <Field label="Until (return or recheck date)">
              <Input type="date" min={today()} value={until} onChange={(e) => setUntil(e.target.value)} className="h-8 text-foreground" />
            </Field>
          )}
          <Field label={reasonRequired ? "Why" : "Note (optional)"}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-14 text-foreground" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={ends ? "destructive" : "default"}
            disabled={busy || !!missing}
            onClick={async () => {
              setBusy(true)
              try {
                if (await onConfirm({ reasonCode: reasonCode || undefined, reason: reason.trim() || undefined, until: until || undefined })) {
                  setReasonCode("")
                  setReason("")
                  setUntil("")
                }
              } finally {
                setBusy(false)
              }
            }}
          >
            {title}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Put a lead anywhere, outside the journey's moves. Always with a reason; the lead is flagged. */
export function OverrideDialog({ open, journey, onClose, onConfirm }: { open: boolean; journey?: Journey; onClose: () => void; onConfirm: (v: { stage: string; lane: string | null; until?: string; reason: string }) => Promise<boolean> }) {
  const [stage, setStage] = useState("register")
  const [lane, setLane] = useState("none")
  const [until, setUntil] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-[460px]">
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <DialogTitle>Override the stage</DialogTitle>
          <DialogDescription>Puts the lead where you choose, outside the normal moves. It's flagged and kept in the history with your reason.</DialogDescription>
        </div>
        <div className="grid grid-cols-2 gap-3 px-6 py-5">
          <Field label="Stage">
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger size="sm" className="w-full bg-card text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {journey?.stages.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Side lane">
            <Select value={lane} onValueChange={setLane}>
              <SelectTrigger size="sm" className="w-full bg-card text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {journey?.lanes.map((l) => (
                  <SelectItem key={l.key} value={l.key}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {lane !== "none" && (
            <Field label="Until (optional)" className="col-span-2">
              <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="h-8 text-foreground" />
            </Field>
          )}
          <Field label="Why" className="col-span-2">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-16 text-foreground" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true)
              try {
                if (await onConfirm({ stage, lane: lane === "none" ? null : lane, until: until || undefined, reason: reason.trim() })) setReason("")
              } finally {
                setBusy(false)
              }
            }}
          >
            Override
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
