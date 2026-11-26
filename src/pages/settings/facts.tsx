import { CircleAlert, CircleCheck, Pencil, Plus } from "lucide-react"
import { useState } from "react"

import { Chip } from "@/components/common/chip"
import { Field } from "@/components/common/form"
import { TONES } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { FactDefinition, FactType, StorageStatus } from "@/lib/types"

import { attempt, Group, LoadError, Loading, SectionCard, useBusy } from "./shared"

// Facts: the fields of every brand's knowledge base, grouped like the Brand Register. Required fields must all be
// verified before the knowledge base is verified (and the brand can go to Target). A field's key and type never
// change once made; fields are switched off rather than deleted, so stored facts keep their meaning. Also shows
// whether dossier storage (S3) is set up.

const GROUPS: { code: FactDefinition["groupCode"]; label: string }[] = [
  { code: "company", label: "Company facts" },
  { code: "asia", label: "Asia position" },
  { code: "regulatory", label: "Regulatory" },
  { code: "outreach", label: "Outreach" },
]
const TYPES: { value: FactType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "usd", label: "Amount (USD)" },
  { value: "date", label: "Date" },
  { value: "yes_no", label: "Yes / no" },
  { value: "choice", label: "One choice" },
  { value: "multi_choice", label: "Several choices" },
]
const typeLabel = (t: string) => TYPES.find((x) => x.value === t)?.label ?? t
const BRAND_FIELDS: Record<string, string> = { homeRevenueUsd: "Home revenue", revenueYear: "Revenue year", asianMarketsLive: "Asian markets live" }

export function FactsSection() {
  const { can } = useSession()
  const defs = useApi<FactDefinition[]>("/knowledge/definitions")
  const storage = useApi<StorageStatus>("/knowledge/storage")
  const [editing, setEditing] = useState<FactDefinition | "new" | null>(null)
  const canEdit = can("settings.edit")
  const list = defs.data ?? []

  return (
    <SectionCard
      value="facts"
      title="Facts"
      description="The knowledge-base form on every brand. Required facts must all be verified by a second person before the brand can move to Target."
      canEdit={canEdit}
      lock={false}
      action={
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus /> Add a field
        </Button>
      }
    >
      <Group
        title="Dossier storage (Amazon S3)"
        hint="Where uploaded dossiers and fetched links are kept. Set in the server's .env (S3_BUCKET, S3_REGION); restart the server after changing it."
        action={
          <Button size="sm" variant="ghost" onClick={() => void storage.reload()}>
            Check again
          </Button>
        }
      >
        {storage.error ? (
          <LoadError message={storage.error} retry={storage.reload} />
        ) : !storage.data ? (
          <Loading />
        ) : (
          <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
            {storage.data.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-[#17b26a]" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-[#b54708]" />}
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{storage.data.ok ? "Connected: uploads work" : storage.data.configured ? "Can't reach the bucket" : "Not set up"}</span>
              {storage.data.bucket && (
                <span className="text-xs text-muted-foreground">
                  s3://{storage.data.bucket}/{storage.data.prefix} · {storage.data.region} · encryption: {storage.data.encryption}
                </span>
              )}
              {storage.data.error && <span className="text-xs text-[#b54708]">{storage.data.error}</span>}
              {storage.data.note && <span className="text-xs text-muted-foreground">{storage.data.note}</span>}
              {!storage.data.configured && <span className="text-xs text-muted-foreground">Until it is, dossiers can't be uploaded, and links are kept as links. The backend README explains the bucket and its access policy.</span>}
            </div>
          </div>
        )}
      </Group>
      {defs.error ? (
        <LoadError message={defs.error} retry={defs.reload} />
      ) : !defs.data ? (
        <Loading />
      ) : (
        GROUPS.map((g) => {
          const rows = list.filter((d) => d.groupCode === g.code)
          if (!rows.length) return null
          return (
            <Group key={g.code} title={g.label}>
              <ul className="divide-y overflow-hidden rounded-lg border">
                {rows.map((d) => (
                  <li key={d.key} className={`flex items-start gap-3 px-4 py-2.5 ${d.active ? "" : "opacity-60"}`}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{d.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {typeLabel(d.type)}
                        {d.options.length ? `: ${d.options.join(", ")}` : ""} · fresh for {d.refreshDays} days
                        {d.brandField ? ` · pre-filled from the brand's ${BRAND_FIELDS[d.brandField] ?? d.brandField}` : ""}
                      </span>
                      {d.help && <span className="text-xs text-muted-foreground">{d.help}</span>}
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      {d.required && <Chip tone={TONES.BLUE}>Required</Chip>}
                      {d.active ? <Chip tone={TONES.GREEN}>In use</Chip> : <Chip tone={TONES.MUTED}>Switched off</Chip>}
                    </span>
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(d)}>
                        <Pencil /> Edit
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Group>
          )
        })
      )}
      {editing && (
        <FactFieldDialog
          def={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void defs.reload()
          }}
        />
      )}
    </SectionCard>
  )
}

function FactFieldDialog({ def, onClose, onSaved }: { def: FactDefinition | null; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(def?.label ?? "")
  const [groupCode, setGroupCode] = useState<string>(def?.groupCode ?? "company")
  const [type, setType] = useState<string>(def?.type ?? "text")
  const [options, setOptions] = useState((def?.options ?? []).join("\n"))
  const [help, setHelp] = useState(def?.help ?? "")
  const [required, setRequired] = useState(def?.required ?? false)
  const [refreshDays, setRefreshDays] = useState(String(def?.refreshDays ?? 180))
  const [active, setActive] = useState(def?.active ?? true)
  const [busy, run] = useBusy()
  const choices = options
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean)
  const isChoice = type === "choice" || type === "multi_choice"
  const days = Number(refreshDays)
  const invalid = label.trim().length < 2 || !Number.isInteger(days) || days < 7 || days > 1825 || (isChoice && choices.length < 2)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-[500px]">
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <DialogTitle>{def ? `Edit ${def.label}` : "Add a fact field"}</DialogTitle>
          <DialogDescription>{def ? "Facts already entered keep their values and dates. A new refresh period applies to facts entered from now on." : "It appears on every brand's knowledge base. Its type can't change later."}</DialogDescription>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto px-6 py-5">
          <Field label="Name">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-foreground" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Group">
              <Select value={groupCode} onValueChange={setGroupCode}>
                <SelectTrigger size="sm" className="w-full bg-card text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUPS.map((g) => (
                    <SelectItem key={g.code} value={g.code}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Type">
              {def ? (
                <Input value={typeLabel(def.type)} disabled className="h-8" />
              ) : (
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger size="sm" className="w-full bg-card text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
          {isChoice && (
            <Field label="Choices (one per line)">
              <Textarea value={options} onChange={(e) => setOptions(e.target.value)} className="min-h-20 text-foreground" />
            </Field>
          )}
          <Field label="Help (shown on the form)">
            <Input value={help} onChange={(e) => setHelp(e.target.value)} className="h-8 text-foreground" />
          </Field>
          <Field label="Fresh for (days after the evidence date)">
            <Input value={refreshDays} inputMode="numeric" onChange={(e) => setRefreshDays(e.target.value.replace(/\D/g, ""))} className="h-8 w-32 text-foreground" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={required} onCheckedChange={setRequired} aria-label="Required" />
            Required for a verified knowledge base
          </label>
          {def && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} aria-label="In use" />
              In use on every brand
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || invalid}
            onClick={async () => {
              const body = { label: label.trim(), groupCode, help: help.trim(), required, refreshDays: days, ...(isChoice ? { options: choices } : {}) }
              const ok = await run(() =>
                def
                  ? attempt(() => api.patch(`/knowledge/definitions/${def.key}`, { ...body, active }), "Field saved.")
                  : attempt(() => api.post("/knowledge/definitions", { ...body, type }), "Field added."),
              )
              if (ok) onSaved()
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
