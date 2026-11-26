import { CircleAlert, History, StickyNote } from "lucide-react"
import { useState } from "react"

import { Chip } from "@/components/common/chip"
import { Field } from "@/components/common/form"
import { AMBER, GREEN, GREY, RED, type Tone } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import { dateLabel, dateTimeLabel } from "@/lib/format"
import type { GateRow, LeadGates, Recommendation, RecordOptions } from "@/lib/types"
import { cn } from "@/lib/utils"

import { attempt } from "../settings/shared"

// The lead's gates as a checklist. A ticked gate has been checked: Pass or Fail. An unticked gate is not checked
// yet (unknown). "Not needed" takes a gate out for this brand (with a reason) so it doesn't count. The recommendation updates with every change and never blocks:
// deciding otherwise is an override, asked for when you move the lead.

const VALUE_TONES: Record<string, Tone> = { pass: GREEN, fail: RED, unknown: GREY }
const VALUE_LABELS: Record<string, string> = { pass: "Pass", fail: "Fail", unknown: "Not checked" }
const SOURCE_LABELS: Record<string, string> = { default: "Not set yet", auto: "From the brand's details", import: "From the register", manual: "Set by hand", call: "From the call" }
const REC_TONES: Record<string, Tone> = { pursue: GREEN, sql: GREEN, review: AMBER, verification_pending: AMBER, not_now: RED }

export function RecommendationChip({ rec }: { rec: Recommendation }) {
  return <Chip tone={REC_TONES[rec.value] ?? GREY}>{rec.label}</Chip>
}

export function GatesPanel({ leadId, closed, options, onChanged }: { leadId: string; closed: boolean; options?: RecordOptions; onChanged: () => void }) {
  const gates = useApi<LeadGates>(`/leads/${leadId}/gates`)
  const [editing, setEditing] = useState<{ gate: GateRow; mode: Mode } | null>(null)
  const [openHistory, setOpenHistory] = useState<string | null>(null)
  // The gate whose note is being written, and the text so far.
  const [noting, setNoting] = useState<{ code: string; text: string } | null>(null)

  const save = async (gate: GateRow, body: Record<string, unknown>) => {
    const r = await attempt(() => api.patch<LeadGates>(`/leads/${leadId}/gates/${gate.code}`, body), `Gate ${gate.code} saved.`)
    if (r) {
      gates.setData(r)
      setEditing(null)
      onChanged()
    }
    return !!r
  }

  if (gates.error) return <p className="text-xs text-destructive">{gates.error}</p>
  if (!gates.data) return <p className="text-xs text-muted-foreground">Loading gates…</p>
  const g = gates.data

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      {(["desk", "call"] as const).map((stage) => {
        const rows = g.gates.filter((x) => x.stage === stage)
        if (!rows.length) return null
        const rec = stage === "desk" ? g.desk : g.call
        return (
          <div key={stage} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">{stage === "desk" ? "Desk gates: decide Target" : "Call gates: confirmed after the call"}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Recommendation <RecommendationChip rec={rec} />
              </span>
            </div>
            {rec.reasons.length > 0 && <span className="text-xs text-muted-foreground">{rec.reasons.join(" · ")}</span>}
            <ul className="divide-y overflow-hidden rounded-lg border">
              {rows.map((gate) => (
                <li key={gate.code} className={cn("flex flex-col gap-1 px-3 py-2", !gate.applies && "bg-muted/30")}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      className="mt-0.5"
                      checked={gate.applies && gate.value !== "unknown"}
                      disabled={!gate.canEdit || closed || !gate.applies}
                      aria-label={`Gate ${gate.code} checked`}
                      onCheckedChange={(v) => setEditing({ gate, mode: v === true ? "check" : "uncheck" })}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className={cn("font-medium", !gate.applies && "text-muted-foreground line-through")}>
                        {gate.code} {gate.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{gate.checks}</span>
                      {!gate.applies && gate.notApplicableReason && <span className="text-xs">Not needed: {gate.notApplicableReason}</span>}
                      {gate.applies && (gate.evidence || gate.setAt) && (
                        <span className="text-xs text-muted-foreground">
                          {SOURCE_LABELS[gate.source]}
                          {gate.setBy ? ` by ${gate.setBy}` : ""}
                          {gate.setAt ? ` · ${dateLabel(gate.setAt)}` : ""}
                          {gate.evidence ? ` · ${gate.evidence}` : ""}
                        </span>
                      )}
                      {gate.disagrees && gate.ruleCheck && (
                        <span className="flex items-start gap-1 text-xs text-[#93370d]">
                          <CircleAlert className="mt-0.5 size-3 shrink-0" />
                          The brand's details say {VALUE_LABELS[gate.ruleCheck.value]}: {gate.ruleCheck.why}
                        </span>
                      )}
                      {gate.applies && gate.value === "unknown" && gate.source !== "auto" && gate.ruleCheck && gate.ruleCheck.value !== "unknown" && <span className="text-xs text-muted-foreground">Suggested from the brand's details: {VALUE_LABELS[gate.ruleCheck.value]}. {gate.ruleCheck.why}</span>}
                      {gate.applies && gate.source === "auto" && <span className="text-xs text-muted-foreground">Set automatically from the brand's details; it follows them until someone sets it by hand.</span>}
                      {gate.note && noting?.code !== gate.code && (
                        <span className="mt-1 rounded-md border bg-[#fffaeb] px-2 py-1 text-xs whitespace-pre-wrap text-foreground">
                          <StickyNote className="mr-1 inline size-3 text-[#b54708]" />
                          {gate.note}
                        </span>
                      )}
                      {noting?.code === gate.code && (
                        <span className="mt-1 flex flex-col gap-1.5">
                          <Textarea autoFocus value={noting.text} onChange={(e) => setNoting({ code: gate.code, text: e.target.value })} placeholder="What was found, what to check next…" className="min-h-16 text-sm text-foreground" />
                          <span className="flex gap-1.5">
                            <Button
                              size="sm"
                              onClick={async () => {
                                if (await save(gate, { note: noting.text })) setNoting(null)
                              }}
                            >
                              Save note
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setNoting(null)}>
                              Cancel
                            </Button>
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {gate.applies ? <Chip tone={VALUE_TONES[gate.value]}>{VALUE_LABELS[gate.value]}</Chip> : <Chip tone={GREY}>Not needed</Chip>}
                      {gate.canEdit && !closed && gate.applies && gate.value !== "unknown" && (
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ gate, mode: "check" })}>
                          Change
                        </Button>
                      )}
                      {gate.canEdit && !closed && gate.applies && (
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setEditing({ gate, mode: "notneeded" })}>
                          Not needed
                        </Button>
                      )}
                      {gate.canEdit && !closed && !gate.applies && (
                        <Button size="sm" variant="ghost" onClick={() => void save(gate, { applies: true })}>
                          Needed again
                        </Button>
                      )}
                      {gate.canEdit && !closed && noting?.code !== gate.code && (
                        <Button size="icon-xs" variant="ghost" aria-label={gate.note ? `Edit the note on gate ${gate.code}` : `Add a note to gate ${gate.code}`} title={gate.note ? "Edit note" : "Add note"} onClick={() => setNoting({ code: gate.code, text: gate.note })}>
                          <StickyNote />
                        </Button>
                      )}
                      {gate.history.length > 0 && (
                        <Button size="icon-xs" variant="ghost" aria-label={`History of gate ${gate.code}`} onClick={() => setOpenHistory(openHistory === gate.code ? null : gate.code)}>
                          <History />
                        </Button>
                      )}
                    </div>
                  </div>
                  {openHistory === gate.code && (
                    <ol className="ml-7 flex flex-col gap-1 border-l pl-3 text-xs">
                      {gate.history.map((h) => (
                        <li key={h.id}>
                          <span className="font-medium">
                            {h.field === "value" ? "Value" : h.field === "applies" ? "Needed" : h.field === "note" ? "Note" : "Evidence"}: {h.before ?? "—"} → {h.after ?? "—"}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {h.actorLabel.replace(/\s*<[^>]*>$/, "")} · {dateTimeLabel(h.at)}
                          </span>
                          {(h.reasonCode || h.reason) && <span className="block text-muted-foreground">{[h.reasonCode, h.reason].filter(Boolean).join(": ")}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {editing && <GateDialog gate={editing.gate} mode={editing.mode} options={options} onClose={() => setEditing(null)} onSave={(body) => save(editing.gate, body)} />}
    </div>
  )
}

type Mode = "check" | "uncheck" | "notneeded"

/**
 * check: tick the gate with Pass or Fail (and evidence) · uncheck: back to not checked · notneeded: take it out for
 * this brand. Changing a value someone already set needs a reason code and one line.
 */
function GateDialog({ gate, mode, options, onClose, onSave }: { gate: GateRow; mode: Mode; options?: RecordOptions; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<boolean> }) {
  const suggested = gate.ruleCheck && gate.ruleCheck.value !== "unknown" ? gate.ruleCheck.value : null
  const [value, setValue] = useState<string>(gate.value !== "unknown" ? gate.value : (suggested ?? ""))
  const [evidence, setEvidence] = useState(gate.evidence)
  const [reasonCode, setReasonCode] = useState(mode === "notneeded" ? "NOT_NEEDED" : "")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const reasons = (options?.lists.gate_change_reason ?? []).filter((r) => !r.retired && r.code !== "IMPORT")
  const target = mode === "uncheck" ? "unknown" : value
  const valueChanged = mode !== "notneeded" && target !== gate.value
  const needsCode = valueChanged && gate.needsReason
  const needsLine = mode === "notneeded" || needsCode
  const missing = (mode === "check" && !value) || (needsCode && !reasonCode) || (needsLine && !reason.trim())
  const title = mode === "check" ? `Check gate ${gate.code} ${gate.name}` : mode === "uncheck" ? `Untick gate ${gate.code} ${gate.name}?` : `Gate ${gate.code} ${gate.name} isn't needed?`
  const help = mode === "check" ? gate.checks : mode === "uncheck" ? "It goes back to Not checked and counts as unknown in the recommendation." : "It stops counting in the recommendation for this brand. You can make it needed again any time."
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-[480px]">
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{help}</DialogDescription>
        </div>
        <div className="flex flex-col gap-3 px-6 py-5">
          {mode === "check" && (
            <>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Result">
                {(["pass", "fail"] as const).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => setValue(v)} className={cn("flex-1 rounded-md border px-3 py-1.5 text-sm", value === v ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted")}>
                    {VALUE_LABELS[v]}
                  </button>
                ))}
              </div>
              {gate.ruleCheck && (
                <p className="text-xs text-muted-foreground">
                  The brand's details say {VALUE_LABELS[gate.ruleCheck.value]}: {gate.ruleCheck.why}
                </p>
              )}
              <Field label="Evidence (one line: where this comes from)">
                <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="e.g. Annual report 2025, p. 12" className="h-8 text-foreground" />
              </Field>
            </>
          )}
          {needsCode && (
            <Field label="Reason for the change">
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger size="sm" className="w-full bg-card text-foreground">
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
          {needsLine && (
            <Field label={mode === "notneeded" ? "Why isn't it needed?" : "One line about it"}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-14 text-foreground" />
            </Field>
          )}
          {!needsLine && <p className="text-xs text-muted-foreground">{gate.needsReason ? "Only the evidence changes: no reason needed." : "First result for this gate: no reason needed. Later changes need one."}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || missing}
            onClick={async () => {
              setBusy(true)
              try {
                await onSave(
                  mode === "notneeded"
                    ? { applies: false, reasonCode, reason: reason.trim() }
                    : { value: target, ...(mode === "check" ? { evidence } : {}), ...(needsCode ? { reasonCode, reason: reason.trim() } : {}) },
                )
              } finally {
                setBusy(false)
              }
            }}
          >
            {mode === "check" ? "Save" : mode === "uncheck" ? "Untick" : "Not needed"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
