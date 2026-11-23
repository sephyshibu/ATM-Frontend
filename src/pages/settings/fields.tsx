import { Archive, ArchiveRestore, Lock, Pencil, Plus } from "lucide-react"
import { Link } from "react-router-dom"
import { useState } from "react"

import { Chip } from "@/components/common/chip"
import { Field } from "@/components/common/form"
import { MoreMenu } from "@/components/common/more-menu"
import { TONES } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { CustomField, FieldType } from "@/lib/types"
import { cn } from "@/lib/utils"

import { attempt, LoadError, Loading, SectionCard, useBusy } from "./shared"

/** A field every brand or product has. Shown here so the full set is in one place; it can't be changed. */
type BuiltInField = { key: string; label: string; type: string; required: boolean; unique?: string; list?: string; help: string }

// Fields: the built-in fields of brands and products (read-only), and extra fields (e.g. "Shelf life (months)", "Halal certified"). They show on the
// brand and product forms and pages, and imports can map columns to them. A field's type is fixed once made;
// fields are retired, never deleted, so values already saved keep their meaning.

const TYPES: { value: FieldType; label: string; hint: string }[] = [
  { value: "text", label: "Short text", hint: "One line" },
  { value: "long_text", label: "Long text", hint: "Several lines" },
  { value: "number", label: "Number", hint: "e.g. 24" },
  { value: "date", label: "Date", hint: "e.g. an expiry date" },
  { value: "yes_no", label: "Yes / no", hint: "" },
  { value: "choice", label: "One choice", hint: "Pick one from a list you set" },
  { value: "multi_choice", label: "Several choices", hint: "Pick any from a list you set" },
]
type Entity = CustomField["entityType"]
const ENTITIES: { key: Entity; label: string }[] = [
  { key: "organisation", label: "Organisation fields" },
  { key: "brand", label: "Brand fields" },
  { key: "product", label: "Product fields" },
  { key: "person", label: "People fields" },
]
const PLACEHOLDERS: Record<Entity, string> = { organisation: "e.g. GST / VAT number", brand: "e.g. Annual marketing budget", product: "e.g. Shelf life (months)", person: "e.g. WhatsApp number" }
const typeLabel = (t: FieldType) => TYPES.find((x) => x.value === t)?.label ?? t
const ROW = "grid grid-cols-[minmax(0,1.4fr)_140px_minmax(0,1.2fr)_90px_28px] items-center gap-3 px-4"

export function FieldsSection() {
  const { can } = useSession()
  const fields = useApi<CustomField[]>("/records/fields")
  const builtIn = useApi<Record<Entity, BuiltInField[]>>("/records/fields/built-in")
  const [entity, setEntity] = useState<Entity>("organisation")
  const [editing, setEditing] = useState<CustomField | "new" | null>(null)
  const canEdit = can("settings.edit")
  const list = (fields.data ?? []).filter((f) => f.entityType === entity)

  return (
    <SectionCard
      value="fields"
      title="Fields"
      description="Every field of organisations, brands, products and people: the built-in ones, and the ones you add. Your fields appear on the forms and pages, and Excel imports can map columns to them."
      canEdit={canEdit}
      lock={false}
      action={
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus /> Add field
        </Button>
      }
    >
      <div className="flex gap-1">
        {ENTITIES.map(({ key: e, label }) => (
          <button key={e} type="button" onClick={() => setEntity(e)} className={cn("rounded-md px-3 py-1.5 text-sm", entity === e ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted")}>
            {label} ({(builtIn.data?.[e].length ?? 0) + (fields.data ?? []).filter((f) => f.entityType === e && !f.retiredAt).length})
          </button>
        ))}
      </div>
      {builtIn.error ? (
        <LoadError message={builtIn.error} retry={builtIn.reload} />
      ) : builtIn.data ? (
        <BuiltInTable fields={builtIn.data[entity]} />
      ) : null}
      <h3 className="-mb-2 text-sm font-semibold">Your fields</h3>
      {fields.error ? (
        <LoadError message={fields.error} retry={fields.reload} />
      ) : !fields.data ? (
        <Loading />
      ) : !list.length ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">No fields of your own yet. Use Add field for anything the built-in fields don’t cover, e.g. shelf life or halal certified.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className={cn(ROW, "border-b bg-muted/40 py-2 text-xs font-medium text-muted-foreground")}>
            <span>Field</span>
            <span>Type</span>
            <span>Choices</span>
            <span>Status</span>
            <span />
          </div>
          <ul className="divide-y">
            {list.map((f) => (
              <li key={f.id} className={cn(ROW, "py-2", f.retiredAt && "opacity-60")}>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">
                    {f.label}
                    {f.required && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Required</span>}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground">{f.key}</span>
                </span>
                <span>{typeLabel(f.type)}</span>
                <span className="truncate text-xs text-muted-foreground">{f.options.join(", ")}</span>
                <span>{f.retiredAt ? <Chip tone={TONES.MUTED}>Retired</Chip> : <Chip tone={TONES.GREEN}>In use</Chip>}</span>
                {canEdit ? (
                  <MoreMenu
                    label={`More options for ${f.label}`}
                    actions={[
                      !f.retiredAt && { label: "Edit", icon: Pencil, onSelect: () => setEditing(f) },
                      {
                        label: f.retiredAt ? "Restore" : "Retire",
                        icon: f.retiredAt ? ArchiveRestore : Archive,
                        destructive: !f.retiredAt,
                        separator: true,
                        onSelect: async () => {
                          if (await attempt(() => api.post(`/records/fields/${f.id}/${f.retiredAt ? "restore" : "retire"}`), f.retiredAt ? `${f.label} is back in use.` : `${f.label} retired. Saved values are kept.`)) void fields.reload()
                        },
                      },
                    ]}
                  />
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <FieldDialog
        open={editing !== null}
        field={editing === "new" ? undefined : (editing ?? undefined)}
        entity={entity}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          void fields.reload()
        }}
      />
    </SectionCard>
  )
}

function FieldDialog({ open, field, entity, onClose, onSaved }: { open: boolean; field?: CustomField; entity: Entity; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-[520px]">{open && <FieldForm field={field} entity={entity} onClose={onClose} onSaved={onSaved} />}</DialogContent>
    </Dialog>
  )
}

function FieldForm({ field, entity, onClose, onSaved }: { field?: CustomField; entity: Entity; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(field?.label ?? "")
  const [type, setType] = useState<FieldType>(field?.type ?? "text")
  const [options, setOptions] = useState((field?.options ?? []).join("\n"))
  const [required, setRequired] = useState(field?.required ?? false)
  const [help, setHelp] = useState(field?.help ?? "")
  const [busy, run] = useBusy()
  const choice = type === "choice" || type === "multi_choice"
  const opts = options
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean)
  const error = !label.trim() ? "Give the field a name." : choice && !opts.length ? "Add at least one choice." : undefined
  const forWhat = field?.entityType ?? entity

  const save = async () => {
    if (error) return
    const body = { label: label.trim(), options: choice ? opts : [], required, help }
    const r = await run(() => attempt(() => (field ? api.patch(`/records/fields/${field.id}`, body) : api.post("/records/fields", { ...body, entityType: forWhat, type })), field ? "Saved." : `${label.trim()} added.`))
    if (r) onSaved()
  }

  return (
    <>
      <div className="flex flex-col gap-1 border-b px-6 py-4">
        <DialogTitle>{field ? `Edit ${field.label}` : `Add a ${forWhat} field`}</DialogTitle>
        <DialogDescription>{field ? "The type can't change once a field is made, so saved values keep their meaning." : `It will show on every ${forWhat}'s form and page${forWhat === "person" ? "" : ", and Excel imports can map a column to it"}.`}</DialogDescription>
      </div>
      <div className="flex flex-col gap-3 px-6 py-5">
        <Field label="Name">
          <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder={PLACEHOLDERS[forWhat]} className="h-8 text-foreground" />
        </Field>
        <Field label="Type">
          <Select value={type} onValueChange={(v) => setType(v as FieldType)} disabled={!!field}>
            <SelectTrigger size="sm" className="w-full bg-card text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                  {t.hint && <span className="text-muted-foreground"> · {t.hint}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {choice && (
          <Field label="Choices, one per line">
            <Textarea value={options} onChange={(e) => setOptions(e.target.value)} placeholder={"Powder\nCapsule\nEffervescent"} className="min-h-24 text-foreground" />
            {field && <span className="text-[11px] text-muted-foreground">A choice already used on records can't be removed; add a new one instead.</span>}
          </Field>
        )}
        <Field label="Help text (optional)">
          <Input value={help} onChange={(e) => setHelp(e.target.value)} placeholder="Shown under the field" className="h-8 text-foreground" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={required} onCheckedChange={setRequired} aria-label="Required" />
          Required: a {forWhat} can't be saved or imported without it
        </label>
        {error && label && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t px-6 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy || !!error}>
          {field ? "Save" : "Add field"}
        </Button>
      </div>
    </>
  )
}

/** The built-in fields: always there, read-only. A field picked from a list links to that list. */
function BuiltInTable({ fields }: { fields: BuiltInField[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        Built-in fields <span className="text-xs font-normal text-muted-foreground">· always there, can't be changed or retired</span>
      </h3>
      <div className="overflow-hidden rounded-lg border">
        <div className={cn(ROW, "border-b bg-muted/40 py-2 text-xs font-medium text-muted-foreground")}>
          <span>Field</span>
          <span>Type</span>
          <span>Choices and rules</span>
          <span>Status</span>
          <span />
        </div>
        <ul className="divide-y">
          {fields.map((f) => (
            <li key={f.key} className={cn(ROW, "py-2")}>
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">
                  {f.label}
                  {f.required && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Required</span>}
                </span>
                {f.help && <span className="truncate text-xs text-muted-foreground">{f.help}</span>}
              </span>
              <span>{f.type}</span>
              <span className="flex min-w-0 flex-col text-xs text-muted-foreground">
                {f.list && (
                  <Link to="/settings?section=lists" className="w-fit text-primary hover:underline">
                    From Lists → {f.list}
                  </Link>
                )}
                {f.unique && <span>{f.unique}</span>}
              </span>
              <span>
                <Chip tone={TONES.BLUE}>Built-in</Chip>
              </span>
              <Lock className="size-3.5 text-muted-foreground" aria-label="Built-in: can't be changed" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
