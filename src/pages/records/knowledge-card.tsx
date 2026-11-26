import { Archive, ArchiveRestore, BadgeCheck, CircleAlert, CircleX, Download, ExternalLink, FileText, History, Link2, Pencil, RefreshCw, ShieldCheck, Upload } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Chip } from "@/components/common/chip"
import { Field } from "@/components/common/form"
import { MoreMenu } from "@/components/common/more-menu"
import { NotePanel } from "@/components/common/panels"
import { showToast } from "@/components/common/toast"
import { AMBER, BLUE, GREEN, GREY, MUTED, RED, ROSE, VIOLET, type Tone } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import { dateLabel, numberLabel, plural } from "@/lib/format"
import type { Dossier, FactField, FactValue, FactVersion, KbStatus, KnowledgeBase, RecordOptions } from "@/lib/types"
import { cn } from "@/lib/utils"

import { useSession } from "@/lib/session"

import { attempt, LoadError, Loading } from "../settings/shared"
import { Card } from "./shared"

// The brand's knowledge base: its dossiers (PDF or Word files kept in S3, or links fetched into storage in the
// background) and its facts. Each fact has a value, a source and an evidence date; a second person verifies or
// rejects it (maker-checker). The knowledge base is verified when every required fact is verified, and it must
// be verified before the brand moves to Target.

const KB_TONES: Record<KbStatus, Tone> = { not_started: GREY, in_progress: AMBER, verified: GREEN, stale: ROSE }
const KB_LABELS: Record<KbStatus, string> = { not_started: "Knowledge base not started", in_progress: "Knowledge base in progress", verified: "Knowledge base verified", stale: "Knowledge base needs a refresh" }

export function KbChip({ status, short }: { status: KbStatus; short?: boolean }) {
  const label = short ? { not_started: "Not started", in_progress: "In progress", verified: "Verified", stale: "Needs a refresh" }[status] : KB_LABELS[status]
  return <Chip tone={KB_TONES[status] ?? GREY}>{label}</Chip>
}

const ACCEPT = ".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
const EXTS = ["pdf", "docx", "doc"]

export function KnowledgeCard({ brandId, options }: { brandId: string; options?: RecordOptions }) {
  const kb = useApi<KnowledgeBase>(`/knowledge/brands/${brandId}`)
  const [editing, setEditing] = useState<FactField | null>(null)
  const [rejecting, setRejecting] = useState<{ field: FactField; fact: FactVersion } | null>(null)

  // While a link is being fetched, look again every 5 seconds so it turns into a file by itself.
  const fetching = kb.data?.dossiers.some((d) => d.status === "queued" || d.status === "fetching" || d.status === "uploading")
  useEffect(() => {
    if (!fetching) return
    const t = window.setInterval(() => void kb.reload(), 5_000)
    return () => window.clearInterval(t)
  }, [fetching, kb.reload])

  if (kb.error) return <LoadError message={kb.error} retry={kb.reload} />
  if (!kb.data) return <Loading />
  const k = kb.data

  const canVerify = (f: FactVersion) => f.status === "entered" && (f.mine ? k.can.verifyOwn : k.can.verify)
  const verifiable = k.groups.flatMap((g) => g.fields).filter((f) => f.current && canVerify(f.current))
  const s = k.status

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <KbChip status={s.status} />
            <span className="text-sm">
              {s.basis === "entered" ? (s.required ? `${s.verified} of ${plural(s.required, "entered fact")} verified` : "No facts entered yet") : `${s.verified} of ${s.required} required facts verified`}
              {s.verifiedAt && s.status !== "in_progress" && s.status !== "not_started" ? <span className="text-muted-foreground"> · since {dateLabel(s.verifiedAt)}</span> : null}
            </span>
          </div>
          {verifiable.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const r = await attempt(() => api.post<{ verified: number; skipped: string[] }>(`/knowledge/brands/${brandId}/facts/verify`, { factIds: verifiable.map((f) => f.current!.id) }), (r) => `${plural(r.verified, "fact")} verified.${r.skipped.length ? ` Skipped: ${r.skipped.join(" ")}` : ""}`)
                if (r) void kb.reload()
              }}
            >
              <ShieldCheck /> Verify {plural(verifiable.length, "fact")}
            </Button>
          )}
        </div>
        {(s.missing.length > 0 || s.waiting.length > 0 || s.stale.length > 0) && (
          <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {s.missing.length > 0 && <li>Missing or rejected: {s.missing.join(", ")}</li>}
            {s.waiting.length > 0 && <li>Waiting for a second person to check: {s.waiting.join(", ")}</li>}
            {s.stale.length > 0 && <li className="text-[#b42318]">Past their refresh date: {s.stale.join(", ")}</li>}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{s.basis === "entered" ? "No fact is required, so the brand moves to Target once every fact that was entered is verified." : "The brand moves to Target once every required fact is verified."} Whoever enters a fact can't check it unless their role allows verifying their own facts (then it's marked self-verified).</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card title="Facts">
          <div className="-my-1 flex flex-col gap-5">
            {k.groups.map((g) => (
              <div key={g.code} className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</h3>
                <ul className="divide-y overflow-hidden rounded-lg border">
                  {g.fields.map((f) => (
                    <FactRow
                      key={f.key}
                      field={f}
                      canEnter={k.can.enter}
                      canVerify={!!f.current && canVerify(f.current)}
                      canReject={!!f.current && f.current.status === "entered" && k.can.verify}
                      onEdit={() => setEditing(f)}
                      onVerify={async () => {
                        if (await attempt(() => api.post(`/knowledge/facts/${f.current!.id}/verify`), `${f.label} verified.`)) void kb.reload()
                      }}
                      onReject={() => setRejecting({ field: f, fact: f.current! })}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
        <DossiersCard brandId={brandId} kb={k} reload={kb.reload} />
      </div>

      {editing && (
        <FactDialog
          brandId={brandId}
          field={editing}
          kb={k}
          options={options}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void kb.reload()
          }}
        />
      )}
      {rejecting && (
        <RejectDialog
          field={rejecting.field}
          fact={rejecting.fact}
          options={options}
          onClose={() => setRejecting(null)}
          onSaved={() => {
            setRejecting(null)
            void kb.reload()
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Facts

export function showValue(type: string, v: FactValue) {
  if (v === null || v === undefined || v === "") return "—"
  // A range is kept as text ("USD 5M–7M", "11–50"): show it as written rather than as a number.
  const isText = typeof v === "string" && !Number.isFinite(Number(v.replace(/,/g, "")))
  if (type === "usd") return isText ? (/^usd\b/i.test(v as string) ? (v as string) : `USD ${v}`) : `USD ${numberLabel(Number(String(v).replace(/,/g, "")))}`
  if (type === "number") return isText ? String(v) : numberLabel(Number(String(v).replace(/,/g, "")))
  if (type === "yes_no") return v ? "Yes" : "No"
  if (type === "date") return dateLabel(String(v))
  if (Array.isArray(v)) return v.join(", ")
  return String(v)
}

const STATUS_CHIP: Record<FactVersion["status"], { tone: Tone; label: string }> = {
  entered: { tone: AMBER, label: "Waiting for a check" },
  verified: { tone: GREEN, label: "Verified" },
  rejected: { tone: RED, label: "Rejected" },
}

function FactRow({ field: f, canEnter, canVerify, canReject, onEdit, onVerify, onReject }: { field: FactField; canEnter: boolean; canVerify: boolean; canReject: boolean; onEdit: () => void; onVerify: () => void; onReject: () => void }) {
  const [showHistory, setShowHistory] = useState(false)
  const c = f.current
  return (
    <li className="flex flex-col gap-1 px-3 py-2.5">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            {f.label}
            {f.required && <span className="text-[11px] font-normal text-muted-foreground">Required</span>}
          </span>
          {c ? (
            <>
              <span className={cn("text-sm break-words whitespace-pre-wrap", c.status === "rejected" && "text-muted-foreground line-through")}>{showValue(f.type, c.value)}</span>
              <span className="text-xs text-muted-foreground">
                {c.source}
                {c.sourceTier ? ` · ${c.sourceTier}` : ""} · evidence {dateLabel(c.evidenceDate)}
                {c.dossier ? ` · from ${c.dossier.title}${c.dossier.archived ? " (archived)" : ""}` : ""}
              </span>
              <span className="text-xs text-muted-foreground">
                {c.origin === "import" ? "Imported" : "Entered"} by {c.enteredBy} · {dateLabel(c.enteredAt)}
                {c.status === "verified" && c.verifiedBy ? ` · checked by ${c.verifiedBy} · ${dateLabel(c.verifiedAt!)}` : ""}
              </span>
              {c.status === "rejected" && c.rejectReason && (
                <span className="flex items-start gap-1 text-xs text-[#b42318]">
                  <CircleAlert className="mt-0.5 size-3 shrink-0" /> Rejected by {c.rejectedBy}: {c.rejectReason}. Enter it again with better evidence.
                </span>
              )}
              {c.note && <span className="text-xs">{c.note}</span>}
              {c.status === "entered" && c.mine && !canVerify && <span className="text-xs text-muted-foreground">You entered it, so someone else checks it.</span>}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              Not entered{f.suggested !== null && f.suggested !== undefined && f.suggested !== "" ? ` · the brand's details say ${showValue(f.type, f.suggested)}` : ""}
            </span>
          )}
          {f.help && !c && <span className="text-xs text-muted-foreground">{f.help}</span>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex flex-wrap justify-end gap-1">
            {c && <Chip tone={STATUS_CHIP[c.status].tone}>{STATUS_CHIP[c.status].label}</Chip>}
            {c?.selfVerified && c.status === "verified" && <Chip tone={VIOLET}>Self-verified</Chip>}
            {c?.stale && <Chip tone={ROSE}>Stale since {dateLabel(c.refreshDue)}</Chip>}
          </div>
          <div className="flex items-center gap-0.5">
            {canVerify && (
              <Button size="xs" variant="soft" onClick={onVerify}>
                Verify
              </Button>
            )}
            {canReject && (
              <Button size="xs" variant="ghost" className="text-destructive" onClick={onReject}>
                Reject
              </Button>
            )}
            {canEnter && (
              <Button size="xs" variant="ghost" onClick={onEdit}>
                <Pencil /> {c ? "Change" : "Enter"}
              </Button>
            )}
            {f.history.length > 0 && (
              <Button size="icon-xs" variant="ghost" aria-label={`Earlier versions of ${f.label}`} onClick={() => setShowHistory(!showHistory)}>
                <History />
              </Button>
            )}
          </div>
        </div>
      </div>
      {showHistory && (
        <ol className="ml-1 flex flex-col gap-1.5 border-l pl-3 text-xs">
          {f.history.map((h) => (
            <li key={h.id} className="flex flex-col">
              <span>
                <span className="font-medium">{showValue(f.type, h.value)}</span> <span className="text-muted-foreground">· {STATUS_CHIP[h.status].label.replace("Waiting for a check", "Entered")}</span>
              </span>
              <span className="text-muted-foreground">
                {h.source} · evidence {dateLabel(h.evidenceDate)} · {h.enteredBy}, {dateLabel(h.enteredAt)}
                {h.verifiedBy ? ` · checked by ${h.verifiedBy}` : ""}
                {h.rejectReason ? ` · rejected: ${h.rejectReason}` : ""} · replaced {dateLabel(h.supersededAt!)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}

/** The form value as the input holds it: text for most types, a boolean for yes/no, a list for several choices. */
function initialValue(f: FactField): string | boolean | string[] {
  const v = f.current && f.current.status !== "rejected" ? f.current.value : (f.current?.value ?? f.suggested)
  if (f.type === "yes_no") return v === true
  if (f.type === "multi_choice") return Array.isArray(v) ? v : []
  if (v === null || v === undefined) return ""
  return Array.isArray(v) ? v.join(", ") : String(v)
}

function FactDialog({ brandId, field: f, kb, options, onClose, onSaved }: { brandId: string; field: FactField; kb: KnowledgeBase; options?: RecordOptions; onClose: () => void; onSaved: () => void }) {
  const c = f.current
  const [value, setValue] = useState<string | boolean | string[]>(initialValue(f))
  const [yesNoSet, setYesNoSet] = useState(f.type !== "yes_no" || (c?.value !== null && c?.value !== undefined))
  const [source, setSource] = useState(c?.source ?? "")
  const [tier, setTier] = useState(c?.sourceTierCode ?? "")
  const [dossierId, setDossierId] = useState(c?.dossier && !c.dossier.archived ? c.dossier.id : "")
  const [evidenceDate, setEvidenceDate] = useState(c?.evidenceDate ?? kb.today)
  const [note, setNote] = useState(c?.note ?? "")
  const [busy, setBusy] = useState(false)
  const tiers = (options?.lists.fact_source_tier ?? []).filter((t) => !t.retired)
  const files = kb.dossiers.filter((d) => !d.archivedAt && (d.status === "stored" || d.kind === "link"))
  const empty = f.type === "yes_no" ? !yesNoSet : f.type === "multi_choice" ? !(value as string[]).length : !String(value).trim()
  const verified = c?.status === "verified"
  const sameEvidence = verified && source.trim() === c!.source && evidenceDate === c!.evidenceDate
  const missing = empty || source.trim().length < 3 || !evidenceDate || evidenceDate > kb.today
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-[520px]">
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <DialogTitle>{c ? `Change ${f.label}` : `Enter ${f.label}`}</DialogTitle>
          <DialogDescription>{f.help || "With its source and the date of the evidence. A second person checks it."}</DialogDescription>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto px-6 py-5">
          {verified && <p className="rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-xs text-[#b54708]">It's verified. A change needs new evidence (a different source or evidence date), and it will need checking again. The current value stays in its history.</p>}
          <Field label="Value">
            <ValueInput field={f} value={value} onChange={(v) => {
              setValue(v)
              setYesNoSet(true)
            }} yesNoSet={yesNoSet} />
          </Field>
          <Field label="Source (dossier page, report or link)">
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Dossier p. 4 · Annual report 2025, p. 12" className="h-8 text-foreground" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Evidence date">
              <Input type="date" value={evidenceDate} max={kb.today} onChange={(e) => setEvidenceDate(e.target.value)} className="h-8 text-foreground" />
            </Field>
            <Field label="Source tier (optional)">
              <Select value={tier || "none"} onValueChange={(v) => setTier(v === "none" ? "" : v)}>
                <SelectTrigger size="sm" className="w-full bg-card text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not said</SelectItem>
                  {tiers.map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {files.length > 0 && (
            <Field label="From the dossier (optional)">
              <Select value={dossierId || "none"} onValueChange={(v) => setDossierId(v === "none" ? "" : v)}>
                <SelectTrigger size="sm" className="w-full bg-card text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {files.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Note (optional)">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-12 text-foreground" />
          </Field>
          <p className="text-xs text-muted-foreground">Stays fresh for {f.refreshDays} days after the evidence date; then it's flagged stale.</p>
          {sameEvidence && <p className="text-xs text-[#b42318]">Give the new source or the date of the new evidence.</p>}
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || missing || sameEvidence}
            onClick={async () => {
              setBusy(true)
              try {
                const body = { value, source: source.trim(), sourceTierCode: tier || null, evidenceDate, dossierId: dossierId || null, note: note.trim() }
                if (await attempt(() => api.put(`/knowledge/brands/${brandId}/facts/${f.key}`, body), `${f.label} saved. It's waiting for a second person to check it.`)) onSaved()
              } finally {
                setBusy(false)
              }
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ValueInput({ field: f, value, onChange, yesNoSet }: { field: FactField; value: string | boolean | string[]; onChange: (v: string | boolean | string[]) => void; yesNoSet: boolean }) {
  if (f.type === "long_text") return <Textarea value={String(value)} onChange={(e) => onChange(e.target.value)} className="min-h-20 text-foreground" />
  if (f.type === "date") return <Input type="date" value={String(value)} onChange={(e) => onChange(e.target.value)} className="h-8 text-foreground" />
  if (f.type === "yes_no")
    return (
      <div className="flex gap-1.5" role="radiogroup" aria-label={f.label}>
        {[true, false].map((v) => (
          <button key={String(v)} type="button" role="radio" aria-checked={yesNoSet && value === v} onClick={() => onChange(v)} className={cn("flex-1 rounded-md border px-3 py-1.5 text-sm", yesNoSet && value === v ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted")}>
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    )
  if (f.type === "choice")
    return (
      <Select value={String(value)} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-full bg-card text-foreground">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          {f.options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  if (f.type === "multi_choice") {
    const list = value as string[]
    return (
      <div className="flex flex-col gap-1.5">
        {f.options.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm">
            <Checkbox checked={list.includes(o)} onCheckedChange={(v) => onChange(v === true ? [...list, o] : list.filter((x) => x !== o))} />
            {o}
          </label>
        ))}
      </div>
    )
  }
  return (
    <Input
      value={String(value)}
      inputMode={f.type === "number" || f.type === "usd" ? "decimal" : undefined}
      placeholder={f.type === "usd" ? "e.g. 12.5M or 12,500,000" : undefined}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 text-foreground"
    />
  )
}

function RejectDialog({ field, fact, options, onClose, onSaved }: { field: FactField; fact: FactVersion; options?: RecordOptions; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const reasons = (options?.lists.fact_reject_reason ?? []).filter((r) => !r.retired)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-[460px]">
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <DialogTitle>Reject {field.label}?</DialogTitle>
          <DialogDescription>
            {showValue(field.type, fact.value)} · {fact.source}. {fact.enteredBy} is asked to enter it again with better evidence.
          </DialogDescription>
        </div>
        <div className="flex flex-col gap-3 px-6 py-5">
          <Field label="Reason">
            <Select value={code} onValueChange={setCode}>
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
          <Field label="What's wrong (one line)">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-14 text-foreground" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !code || reason.trim().length < 3}
            onClick={async () => {
              setBusy(true)
              try {
                if (await attempt(() => api.post(`/knowledge/facts/${fact.id}/reject`, { reasonCode: code, reason: reason.trim() }), `${field.label} rejected.`)) onSaved()
              } finally {
                setBusy(false)
              }
            }}
          >
            Reject
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- Dossiers

const DOSSIER_CHIP: Record<Dossier["status"], { tone: Tone; label: string } | null> = {
  stored: null,
  uploading: { tone: BLUE, label: "Uploading" },
  queued: { tone: BLUE, label: "Fetching soon" },
  fetching: { tone: BLUE, label: "Fetching" },
  linked: { tone: BLUE, label: "Google link" },
  link_only: { tone: AMBER, label: "Link only" },
  failed: { tone: RED, label: "Failed" },
}
const ORIGIN: Record<Dossier["origin"], string> = { upload: "Uploaded", import: "From the Brand Register", link: "Link added" }

function DossiersCard({ brandId, kb, reload }: { brandId: string; kb: KnowledgeBase; reload: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ name: string; share: number } | null>(null)
  const [addingLink, setAddingLink] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [dragging, setDragging] = useState(false)
  const active = kb.dossiers.filter((d) => !d.archivedAt)
  const archived = kb.dossiers.filter((d) => d.archivedAt)
  const canAttach = kb.can.attach

  const send = async (file: File) => {
    const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? ""
    if (!EXTS.includes(ext)) return showToast(`${file.name}: only PDF and Word files (.pdf, .docx, .doc) can be attached.`, "warning")
    if (file.size > kb.maxMb * 1024 * 1024) return showToast(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${kb.maxMb} MB.`, "warning")
    const form = new FormData()
    form.append("file", file, file.name)
    setProgress({ name: file.name, share: 0 })
    try {
      const r = await attempt(() => api.upload(`/knowledge/brands/${brandId}/dossiers`, form, (share) => setProgress({ name: file.name, share })), `${file.name} uploaded.`)
      if (r) reload()
    } finally {
      setProgress(null)
    }
  }

  return (
    <Card
      title={`Dossiers (${active.length})`}
      className={cn(dragging && "ring-2 ring-primary/40")}
      action={
        canAttach && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setAddingLink(true)}>
              <Link2 /> Add link
            </Button>
            <Button size="sm" variant="outline" disabled={!kb.storage.configured || !!progress} title={kb.storage.configured ? undefined : "File storage isn't set up yet"} onClick={() => input.current?.click()}>
              <Upload /> Upload
            </Button>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                if (f) void send(f)
              }}
            />
          </div>
        )
      }
    >
      <div
        className="flex flex-col gap-3"
        onDragOver={(e) => {
          if (!canAttach || !kb.storage.configured) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (!canAttach || !kb.storage.configured) return
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files?.[0]
          if (f) void send(f)
        }}
      >
        {!kb.storage.configured && <p className="rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-xs text-[#b54708]">File storage (S3) isn't set up on the server yet, so files can't be uploaded. Links are kept as links until it is.</p>}
        {progress && (
          <div className="flex flex-col gap-1" aria-live="polite">
            <span className="truncate text-xs">
              Uploading {progress.name}… {Math.round(progress.share * 100)}%
            </span>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress.share * 100)}%` }} />
            </div>
          </div>
        )}
        {active.length ? (
          <ul className="-my-1 divide-y">
            {active.map((d) => (
              <DossierRow key={d.id} d={d} canAttach={canAttach} storage={kb.storage.configured} reload={reload} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No dossier yet. {canAttach ? (kb.storage.configured ? "Upload the PDF or Word file (or drop it here), or add a link." : "Add a link.") : ""}</p>
        )}
        {canAttach && kb.storage.configured && <p className="text-xs text-muted-foreground">PDF or Word (.pdf, .docx, .doc), up to {kb.maxMb} MB. Files are stored encrypted in S3.</p>}
        {archived.length > 0 && (
          <div className="flex flex-col gap-1">
            <button type="button" className="w-fit text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? "Hide" : "Show"} {plural(archived.length, "archived dossier")}
            </button>
            {showArchived && (
              <ul className="divide-y opacity-75">
                {archived.map((d) => (
                  <DossierRow key={d.id} d={d} canAttach={canAttach} storage={kb.storage.configured} reload={reload} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {addingLink && (
        <LinkDialog
          brandId={brandId}
          onClose={() => setAddingLink(false)}
          onSaved={() => {
            setAddingLink(false)
            reload()
          }}
        />
      )}
    </Card>
  )
}

/** A Google Drive, Docs, Sheets or Slides link. */
const isGoogle = (url: string | null) => {
  try {
    return !!url && ["drive.google.com", "docs.google.com"].includes(new URL(url).hostname.toLowerCase())
  } catch {
    return false
  }
}

function DossierRow({ d, canAttach, storage, reload }: { d: Dossier; canAttach: boolean; storage: boolean; reload: () => void }) {
  const { can } = useSession()
  const [checking, setChecking] = useState(false)
  const canCheck = ["kb.enter_facts", "kb.import", "kb.verify_facts", "kb.verify_own_facts"].some((p) => can(p))
  const stored = d.status === "stored"
  // A private Google file kept as a link is the normal case (the dossier drive is locked), not a problem: it opens
  // in Google with the reader's own sign-in, so it gets a calm chip and note instead of a warning.
  const googleLink = d.status === "linked" || (d.status === "link_only" && isGoogle(d.sourceUrl) && (!d.statusNote || /google|sign-in|HTTP 40[13]|web page/i.test(d.statusNote)))
  const chip = googleLink ? { tone: BLUE, label: "Google link" } : DOSSIER_CHIP[d.status]
  const statusNote = googleLink ? (d.checked ? null : "Opens in Google with your own sign-in. Open it, check it's the right dossier, and mark it as checked.") : d.statusNote
  const checkable = !d.archivedAt && !d.checked && (stored || googleLink || d.status === "link_only") && canCheck
  const download = async () => {
    const r = await attempt(() => api.get<{ url: string }>(`/knowledge/dossiers/${d.id}/download`))
    // The link answers with "download as", so the page stays where it is.
    if (r) window.location.assign(r.url)
  }
  return (
    <li className="flex items-start gap-3 py-2.5">
      {d.kind === "file" || stored ? <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          {stored ? (
            <button type="button" className="text-left font-medium break-all hover:underline" onClick={download}>
              {d.fileName ?? d.title}
            </button>
          ) : googleLink && d.sourceUrl ? (
            <a href={d.sourceUrl} target="_blank" rel="noreferrer noopener" className="font-medium break-all hover:underline">
              {d.title}
            </a>
          ) : (
            <span className="font-medium break-all">{d.title}</span>
          )}
          {chip && <Chip tone={chip.tone}>{chip.label}</Chip>}
          {d.checked && (
            <Chip tone={GREEN}>
              {d.checked.self ? "Self-checked" : "Checked"}
              {d.checked.by ? ` by ${d.checked.by}` : ""} · {dateLabel(d.checked.at)}
            </Chip>
          )}
          {d.archivedAt && <Chip tone={MUTED}>Archived</Chip>}
        </span>
        <span className="text-xs text-muted-foreground">
          {[stored && d.fileTypeLabel, stored && d.size, ORIGIN[d.origin], d.createdBy && `by ${d.createdBy}`, dateLabel(d.createdAt)].filter(Boolean).join(" · ")}
        </span>
        {d.sourceUrl && (
          <a href={d.sourceUrl} target="_blank" rel="noreferrer noopener" className="flex w-fit max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground">
            <ExternalLink className="size-3 shrink-0" /> <span className="truncate">{d.sourceUrl}</span>
          </a>
        )}
        {statusNote && !stored && <span className={cn("text-xs", !googleLink && (d.status === "link_only" || d.status === "failed") ? "text-[#b54708]" : "text-muted-foreground")}>{statusNote}</span>}
        {d.checked && (d.checked.versionDate || d.checked.note) && (
          <span className="text-xs text-muted-foreground">
            {[d.checked.versionDate && `Checked the version of ${dateLabel(d.checked.versionDate)}`, d.checked.note && `“${d.checked.note}”`].filter(Boolean).join(" · ")}
          </span>
        )}
        {checking && <CheckPanel d={d} onClose={() => setChecking(false)} onDone={reload} />}
        {d.note && <span className="text-xs">{d.note}</span>}
        {d.archivedAt && d.archiveReason && <span className="text-xs text-muted-foreground">Archived: {d.archiveReason}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {checkable && !checking && (
          <Button size="xs" variant="outline" onClick={() => setChecking(true)}>
            <BadgeCheck /> Mark as checked
          </Button>
        )}
        {stored && (
          <Button size="icon-xs" variant="ghost" aria-label={`Download ${d.fileName ?? d.title}`} onClick={download}>
            <Download />
          </Button>
        )}
        {(canAttach || canCheck) && (
          <MoreMenu
            label={`More options for ${d.title}`}
            actions={[
              !!d.checked &&
                canCheck && {
                  label: "Take back the check",
                  icon: CircleX,
                  panel: (close) => (
                    <NotePanel
                      title="Take back the check?"
                      placeholder="Why? (e.g. wrong file, or the dossier changed)"
                      confirm="Take back"
                      required
                      close={close}
                      onConfirm={async (reason) => {
                        if (await attempt(() => api.post(`/knowledge/dossiers/${d.id}/uncheck`, { reason }), "Check taken back.")) reload()
                      }}
                    />
                  ),
                },
              canAttach &&
                d.kind === "link" &&
                !d.archivedAt &&
                !googleLink &&
                (d.status === "link_only" || d.status === "failed") && {
                  label: "Fetch again",
                  icon: RefreshCw,
                  disabled: !storage,
                  title: storage ? undefined : "File storage isn't set up yet",
                  onSelect: async () => {
                    if (await attempt(() => api.post(`/knowledge/dossiers/${d.id}/retry`), "Fetching it again.")) reload()
                  },
                },
              !canAttach
                ? false
                : d.archivedAt
                ? {
                    label: "Restore",
                    icon: ArchiveRestore,
                    onSelect: async () => {
                      if (await attempt(() => api.post(`/knowledge/dossiers/${d.id}/restore`), `${d.title} restored.`)) reload()
                    },
                  }
                : {
                    label: "Archive",
                    icon: Archive,
                    destructive: true,
                    panel: (close) => (
                      <NotePanel
                        title={`Archive ${d.title}?`}
                        placeholder="Why? (e.g. replaced by a newer dossier)"
                        confirm="Archive"
                        destructive
                        required
                        close={close}
                        onConfirm={async (reason) => {
                          if (await attempt(() => api.post(`/knowledge/dossiers/${d.id}/archive`, { reason }), `${d.title} archived. The file is kept.`)) reload()
                        }}
                      />
                    ),
                  },
            ]}
          />
        )}
      </div>
    </li>
  )
}

/** "Mark as checked": an optional note and the date of the version that was read (Google's "Last edit"). */
function CheckPanel({ d, onClose, onDone }: { d: Dossier; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("")
  const [versionDate, setVersionDate] = useState("")
  const [busy, setBusy] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="mt-1.5 flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">
        {d.google ? "Open the Google link, make sure it's this brand's dossier and its content is correct, then confirm." : "Open the file, make sure it's this brand's dossier and its content is correct, then confirm."}
      </p>
      <Field label={d.google ? "Version you read (Google's \"Last edit\" date, optional)" : "Version date (optional)"}>
        <Input type="date" max={today} value={versionDate} onChange={(e) => setVersionDate(e.target.value)} className="h-8 w-44 text-foreground" />
      </Field>
      <Field label="Note (optional)">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Right brand; revenue and Asia sections read" className="min-h-14 text-foreground" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const r = await attempt(() => api.post(`/knowledge/dossiers/${d.id}/check`, { note, versionDate: versionDate || null }), `${d.title} marked as checked.`)
            setBusy(false)
            if (r) {
              onClose()
              onDone()
            }
          }}
        >
          <BadgeCheck /> {busy ? "Saving…" : "Mark as checked"}
        </Button>
      </div>
    </div>
  )
}

function LinkDialog({ brandId, onClose, onSaved }: { brandId: string; onClose: () => void; onSaved: () => void }) {
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-[480px]">
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <DialogTitle>Add a dossier link</DialogTitle>
          <DialogDescription>A Google Doc or Google Drive file, Dropbox, SharePoint, or a direct link to a PDF or Word file. Public files are copied into storage in the background. Private Google files (like the dossier drive) are kept as links that open with your own sign-in; never make a confidential file public to get a copy.</DialogDescription>
        </div>
        <div className="flex flex-col gap-3 px-6 py-5">
          <Field label="Link">
            <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…" className="h-8 text-foreground" />
          </Field>
          <Field label="Name (optional)">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Glow Co dossier, March 2026" className="h-8 text-foreground" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || url.trim().length < 4}
            onClick={async () => {
              setBusy(true)
              try {
                if (await attempt(() => api.post(`/knowledge/brands/${brandId}/links`, { url: url.trim(), title: title.trim() || undefined }), "Link added. The file is being fetched.")) onSaved()
              } finally {
                setBusy(false)
              }
            }}
          >
            Add link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
