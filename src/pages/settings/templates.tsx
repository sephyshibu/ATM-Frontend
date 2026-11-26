import { Archive, ArchiveRestore, BadgeCheck, Eye, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Chip } from "@/components/common/chip"
import { EmailPreview } from "@/components/common/email-preview"
import { Field } from "@/components/common/form"
import { SearchPick } from "@/components/common/search-pick"
import { TONES } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import { dateLabel } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { Brand, MergeField, TemplateDetail, TemplateKind, TemplatePreview, TemplateStep, TemplateSummary, TemplateVersion } from "@/lib/types"

import { attempt, Group, LoadError, Loading, SectionCard, useBusy } from "./shared"

// Email templates: outreach sequences (7 emails) and booking emails (email 1 and the reminder). Every edit is a
// draft version; anyone with "Approve templates" approves it (its author too: recorded as self-approved); only the approved version is used, and a newer
// approval replaces it for future contacts only. Which brand gets which template is set in Template matrix.

const KIND: Record<TemplateKind, { title: string; hint: string; steps: number }> = {
  sequence: { title: "Outreach sequences", hint: "7 emails each. The first goes on the release day; each next one waits the days you set.", steps: 7 },
  booking: { title: "Booking emails", hint: "Email 1 with the booking link, and the reminder (sent after the working days in Configuration → Booking emails).", steps: 2 },
}
const STEP_NAMES: Record<TemplateKind, (i: number) => string> = { sequence: (i) => `Email ${i + 1}`, booking: (i) => (i === 0 ? "Booking email 1" : "Booking reminder") }
const STATUS: Record<TemplateVersion["status"], { tone: (typeof TONES)[keyof typeof TONES]; label: string }> = {
  draft: { tone: TONES.AMBER, label: "Draft" },
  approved: { tone: TONES.GREEN, label: "In use" },
  superseded: { tone: TONES.MUTED, label: "Replaced" },
  discarded: { tone: TONES.MUTED, label: "Discarded" },
}

const blankSteps = (kind: TemplateKind): TemplateStep[] =>
  Array.from({ length: KIND[kind].steps }, (_, i) =>
    kind === "sequence"
      ? { subject: i === 0 ? "{{brandName}} in Asia" : `Re: {{brandName}} in Asia`, body: i === 0 ? "Hi {{firstName|there}},\n\n{{touchOne}}\n\n…\n\n{{senderFirstName}}" : "Hi {{firstName|there}},\n\n…\n\n{{senderFirstName}}", delayDays: i === 0 ? 0 : 3 }
      : { subject: i === 0 ? "Booking a call about {{brandName}}" : "Re: Booking a call about {{brandName}}", body: i === 0 ? "Hi {{firstName|there}},\n\nPick a time that suits you: {{bookingLink}}\n\n{{senderFirstName}}" : "Hi {{firstName|there}},\n\nA quick reminder: {{bookingLink}}\n\n{{senderFirstName}}", delayDays: 0 },
  )

export function TemplatesSection() {
  const { can } = useSession()
  const list = useApi<TemplateSummary[]>("/templates")
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState<TemplateKind | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const canWrite = can("templates.write")
  const rows = list.data ?? []

  return (
    <SectionCard
      value="templates"
      title="Email templates"
      description="The wording brands get. Every edit is a draft until it's approved; edits only affect future contacts. Which brand gets which template is set in Template matrix."
      canEdit={canWrite || can("templates.approve")}
      lock={false}
      readOnlyNote="You can look, but your roles don't allow writing or approving templates."
    >
      {list.error ? (
        <LoadError message={list.error} retry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : (
        (["sequence", "booking"] as TemplateKind[]).map((kind) => {
          const shown = rows.filter((t) => t.kind === kind && (showArchived || !t.archived))
          return (
            <Group
              key={kind}
              title={KIND[kind].title}
              hint={KIND[kind].hint}
              action={
                canWrite && (
                  <Button size="sm" variant="outline" onClick={() => setAdding(kind)}>
                    <Plus /> New {kind === "sequence" ? "sequence" : "booking template"}
                  </Button>
                )
              }
            >
              {shown.length === 0 ? (
                <p className="rounded-lg border border-dashed px-4 py-3 text-muted-foreground">None yet.</p>
              ) : (
                <ul className="divide-y overflow-hidden rounded-lg border">
                  {shown.map((t) => (
                    <li key={t.id} className={`flex items-start gap-3 px-4 py-2.5 ${t.archived ? "opacity-60" : ""}`}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">{t.name}</span>
                        {t.description && <span className="text-xs text-muted-foreground">{t.description}</span>}
                        <span className="text-xs text-muted-foreground">
                          {[
                            t.live ? `Version ${t.live.version} in use${t.live.approvedBy ? `, approved by ${t.live.approvedBy.replace(/ <.*>$/, "")}` : ""}` : "No approved version yet",
                            t.draft && `draft version ${t.draft.version} by ${t.draft.by.replace(/ <.*>$/, "")} waiting for approval`,
                            t.usedIn ? `used in ${t.usedIn} matrix ${t.usedIn === 1 ? "cell" : "cells"}` : "not in the matrix",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {t.archived ? <Chip tone={TONES.MUTED}>Archived</Chip> : t.live ? <Chip tone={TONES.GREEN}>In use</Chip> : null}
                        {t.draft && <Chip tone={TONES.AMBER}>Draft</Chip>}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => setOpen(t.id)}>
                        <Pencil /> Open
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Group>
          )
        })
      )}
      {rows.some((t) => t.archived) && (
        <button type="button" className="w-fit text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide archived templates" : "Show archived templates"}
        </button>
      )}
      {adding && (
        <TemplateEditor
          kind={adding}
          onClose={() => setAdding(null)}
          onSaved={(id) => {
            setAdding(null)
            void list.reload()
            if (id) setOpen(id)
          }}
        />
      )}
      {open && (
        <TemplateEditor
          id={open}
          onClose={() => {
            setOpen(null)
            void list.reload()
          }}
          onSaved={() => void list.reload()}
        />
      )}
    </SectionCard>
  )
}

/** One template: its versions, the wording (edit = draft), approve / discard, preview against a brand. */
function TemplateEditor({ id, kind: newKind, onClose, onSaved }: { id?: string; kind?: TemplateKind; onClose: () => void; onSaved: (id?: string) => void }) {
  const { can } = useSession()
  const detail = useApi<TemplateDetail>(id ? `/templates/${id}` : null)
  const fields = useApi<MergeField[]>("/templates/merge-fields")
  const brands = useApi<Brand[]>("/records/brands")
  const d = detail.data
  const kind: TemplateKind = d?.kind ?? newKind ?? "sequence"
  const [viewing, setViewing] = useState<string | null>(null)
  const [editing, setEditing] = useState(!id)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [steps, setSteps] = useState<TemplateStep[]>(blankSteps(kind))
  const [openingFallback, setOpeningFallback] = useState(kind === "sequence" ? "Looking at how {{category|brands like yours}} brands are landing in Southeast Asia, one question keeps coming up." : "")
  const [note, setNote] = useState("")
  const [brandId, setBrandId] = useState("")
  const [preview, setPreview] = useState<TemplatePreview | null>(null)
  const [busy, run] = useBusy()
  const canWrite = can("templates.write")

  const draft = d?.versions.find((v) => v.status === "draft") ?? null
  const live = d?.versions.find((v) => v.status === "approved") ?? null
  const shown = d?.versions.find((v) => v.id === viewing) ?? draft ?? live ?? d?.versions[0] ?? null

  useEffect(() => {
    if (!d) return
    setName(d.name)
    setDescription(d.description)
  }, [d])

  const startEditing = () => {
    const from = draft ?? live ?? shown
    if (from) {
      setSteps(from.steps.map((s) => ({ ...s })))
      setOpeningFallback(from.openingFallback)
    }
    setNote(draft?.note ?? "")
    setPreview(null)
    setEditing(true)
  }

  const brandOptions = useMemo(() => (brands.data ?? []).filter((b) => !b.archivedAt).map((b) => ({ value: b.id, label: b.name })), [brands.data])
  const runPreview = async (wording: { steps: TemplateStep[]; openingFallback: string }) => {
    if (!brandId) return
    const r = await attempt(() => api.post<TemplatePreview>(`/templates/preview/${kind}`, { brandId, steps: wording.steps, openingFallback: wording.openingFallback }))
    if (r) setPreview(r)
  }

  const save = async () => {
    const body = { steps, openingFallback, note: note.trim() || undefined, name: name.trim(), description: description.trim() }
    if (!id) {
      const r = await run(() => attempt(() => api.post<{ id: string }>("/templates", { ...body, kind }), "Template added as a draft. Approve it to use it."))
      if (r) onSaved(r.id)
      return
    }
    const r = await run(() => attempt(() => api.put<{ version: number }>(`/templates/${id}/draft`, body), (x) => `Draft version ${x.version} saved. Approve it to use it.`))
    if (r) {
      setEditing(false)
      setViewing(null)
      void detail.reload()
      onSaved()
    }
  }

  const setStep = (i: number, patch: Partial<TemplateStep>) => setSteps((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-[1100px]">
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <DialogTitle>{id ? (d?.name ?? "Template") : `New ${kind === "sequence" ? "outreach sequence" : "booking template"}`}</DialogTitle>
          <DialogDescription>{KIND[kind].hint} Merge fields like {"{{firstName}}"} are filled per brand; {"{{firstName|there}}"} gives a fallback.</DialogDescription>
        </div>
        {id && detail.error ? (
          <div className="p-6">
            <LoadError message={detail.error} retry={detail.reload} />
          </div>
        ) : id && !d ? (
          <div className="p-6">
            <Loading />
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            {/* Left: versions and wording */}
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
              {d && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {d.versions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setViewing(v.id)
                        setEditing(false)
                        setPreview(null)
                      }}
                      className={`rounded-md border px-2 py-1 text-xs ${shown?.id === v.id && !editing ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted"}`}
                    >
                      v{v.version} · {STATUS[v.status].label}
                    </button>
                  ))}
                </div>
              )}

              {(editing || !id) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Health supplements – Entry" className="h-8 text-foreground" />
                  </Field>
                  <Field label="Description (optional)">
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who it's for" className="h-8 text-foreground" />
                  </Field>
                </div>
              )}

              {!editing && shown ? (
                <VersionView kind={kind} v={shown} />
              ) : (
                <>
                  {steps.map((s, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{STEP_NAMES[kind](i)}</span>
                        {kind === "sequence" && i > 0 && (
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            Wait
                            <Input type="number" min={1} max={60} value={s.delayDays} onChange={(e) => setStep(i, { delayDays: Number(e.target.value) })} className="h-7 w-16 text-foreground" />
                            days after the previous email
                          </label>
                        )}
                        {kind === "sequence" && i === 0 && <span className="text-xs text-muted-foreground">On the release day</span>}
                      </div>
                      <Input value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} placeholder="Subject" maxLength={200} className="h-8 text-foreground" />
                      <Textarea value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} placeholder="The email" className="min-h-32 font-mono text-[13px] text-foreground" />
                    </div>
                  ))}
                  {kind === "sequence" && (
                    <Field label="Back-up opening line (used in place of {{touchOne}} when a brand has no verified touch-one observation)">
                      <Textarea value={openingFallback} onChange={(e) => setOpeningFallback(e.target.value)} className="min-h-16 text-foreground" />
                    </Field>
                  )}
                  <Field label="What changed (optional)">
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Shorter first email" className="h-8 text-foreground" />
                  </Field>
                </>
              )}
            </div>

            {/* Right: merge fields and preview */}
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto border-t bg-muted/20 px-6 py-5 lg:border-t-0 lg:border-l">
              <Group title="Preview with a brand" hint="Fills the emails with the brand's details. Facts are used only when verified.">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <SearchPick options={brandOptions} value={brandId} onChange={(v) => {
                      setBrandId(v)
                      setPreview(null)
                    }} placeholder="Pick a brand" aria-label="Brand to preview" />
                  </div>
                  <Button size="sm" variant="outline" disabled={!brandId} onClick={() => void runPreview(editing || !shown ? { steps, openingFallback } : { steps: shown.steps, openingFallback: shown.openingFallback })}>
                    <Eye /> Preview
                  </Button>
                </div>
                {preview && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      {preview.contact ? `To ${preview.contact.name}${preview.contact.email ? ` <${preview.contact.email}>` : " (no email)"} · ${preview.contact.why}` : "This brand has no contact."}
                      {" · "}
                      Touch-one: {preview.touchOne === "verified" ? "verified" : preview.touchOne === "not_verified" ? "entered, not verified (not used)" : "none"}
                      {preview.usedFallbackOpening ? " · back-up opening line used" : ""}
                    </p>
                    {preview.problems.length > 0 && <p className="text-xs text-destructive">{preview.problems.join(" ")}</p>}
                    {preview.missing.length > 0 && <p className="text-xs text-[#b54708]">Empty for this brand: {preview.missing.join(", ")}.</p>}
                    <EmailPreview steps={preview.steps} />
                  </div>
                )}
              </Group>
              <Group title="Merge fields" hint="Type them into the subject or the email.">
                <ul className="flex flex-col gap-1 text-xs">
                  {(fields.data ?? []).map((f) => (
                    <li key={f.key} className="flex flex-col">
                      <span>
                        <code className="rounded bg-muted px-1">{`{{${f.key}}}`}</code> <span className="text-muted-foreground">{f.label}</span>
                      </span>
                      {f.help && <span className="text-muted-foreground">{f.help}</span>}
                    </li>
                  ))}
                </ul>
              </Group>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {d && !editing && canWrite && !d.archived && (
              <Button size="sm" variant="outline" onClick={startEditing}>
                <Pencil /> {draft ? "Edit the draft" : "Edit (makes a new draft)"}
              </Button>
            )}
            {d && !editing && shown?.status === "draft" && d.can.approve && (
              <Button
                size="sm"
                disabled={busy}
                title={shown.mine ? "You wrote or edited this version: it will be recorded as self-approved." : undefined}
                onClick={async () => {
                  const ok = await run(() => attempt(() => api.post(`/templates/versions/${shown.id}/approve`), `Version ${shown.version} ${shown.mine ? "self-approved" : "approved"}. Future contacts get it.`))
                  if (ok) {
                    setViewing(null)
                    void detail.reload()
                    onSaved()
                  }
                }}
              >
                <BadgeCheck /> Approve version {shown.version}
              </Button>
            )}
            {d && !editing && shown?.status === "draft" && canWrite && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(() => attempt(() => api.post(`/templates/versions/${shown.id}/discard`), "Draft discarded."))
                  if (ok) {
                    setViewing(null)
                    void detail.reload()
                    onSaved()
                  }
                }}
              >
                <Trash2 /> Discard draft
              </Button>
            )}
            {d && !editing && canWrite && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(() => attempt(() => api.post(`/templates/${d.id}/${d.archived ? "restore" : "archive"}`), d.archived ? "Template restored." : "Template archived."))
                  if (ok) {
                    void detail.reload()
                    onSaved()
                  }
                }}
              >
                {d.archived ? <ArchiveRestore /> : <Archive />} {d.archived ? "Restore" : "Archive"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {editing && id && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel edit
              </Button>
            )}
            {editing ? (
              <Button disabled={busy || name.trim().length < 2} onClick={save}>
                {busy ? "Saving…" : "Save draft"}
              </Button>
            ) : (
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function VersionView({ kind, v }: { kind: TemplateKind; v: TemplateVersion }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Chip tone={STATUS[v.status].tone}>{STATUS[v.status].label}</Chip>
        Version {v.version} by {v.createdBy.replace(/ <.*>$/, "")} · {dateLabel(v.updatedAt)}
        {v.approvedBy && ` · ${v.selfApproved ? "self-approved" : "approved"} by ${v.approvedBy.replace(/ <.*>$/, "")} on ${dateLabel(v.approvedAt!)}`}
        {v.note && ` · “${v.note}”`}
      </p>
      {v.steps.map((s, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-lg border p-3">
          <span className="flex items-center justify-between text-xs">
            <span className="font-semibold">{STEP_NAMES[kind](i)}</span>
            <span className="text-muted-foreground">{i === 0 ? "On the release day" : kind === "booking" ? "After the reminder wait (Configuration)" : `${s.delayDays} days after the previous email`}</span>
          </span>
          <span className="font-medium">{s.subject}</span>
          <span className="text-sm whitespace-pre-wrap text-muted-foreground">{s.body}</span>
        </div>
      ))}
      {kind === "sequence" && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Back-up opening line: </span>
          {v.openingFallback || "none (the first email has no opening line when there's no touch-one)"}
        </p>
      )}
    </div>
  )
}
