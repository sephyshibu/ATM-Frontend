import { Field } from "@/components/common/form"
import { MultiPick, SearchPick } from "@/components/common/search-pick"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { CustomField, CustomValues, RecordOptions } from "@/lib/types"

import { Row } from "./shared"

// The fields added in Settings → Fields, on the brand and product forms and pages. Values are kept as typed and
// checked by the server (numbers, dates, choices); a retired field still shows its old value, read-only.

export type Entity = "organisation" | "brand" | "product" | "person"

/** The fields a form shows: every field in use, plus retired ones that still hold a value on this record. */
export function fieldsFor(options: RecordOptions | undefined, entity: Entity, values?: CustomValues) {
  return (options?.fields ?? []).filter((f) => f.entityType === entity && (!f.retiredAt || (values && values[f.key] !== undefined && values[f.key] !== null)))
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)

/** The first required field left empty, for the form's error line. */
export function missingRequired(fields: CustomField[], values: Record<string, unknown>) {
  return fields.find((f) => f.required && !f.retiredAt && isEmpty(values[f.key]))
}

/** What the form sends: only fields in use (retired ones can't change). */
export function customPayload(fields: CustomField[], values: Record<string, unknown>) {
  return Object.fromEntries(fields.filter((f) => !f.retiredAt).map((f) => [f.key, values[f.key] ?? null]))
}

export function CustomFieldInputs({ fields, values, onChange, tried }: { fields: CustomField[]; values: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; tried?: boolean }) {
  if (!fields.length) return null
  const set = (key: string, v: unknown) => onChange({ ...values, [key]: v })
  return (
    <>
      {fields.map((f) => {
        const v = values[f.key]
        const label = `${f.label}${f.required ? " *" : ""}${f.retiredAt ? " (retired)" : ""}`
        const invalid = tried && f.required && !f.retiredAt && isEmpty(v)
        const wide = f.type === "long_text" || f.type === "multi_choice"
        let input: React.ReactNode
        switch (f.type) {
          case "long_text":
            input = <Textarea value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} disabled={!!f.retiredAt} aria-invalid={invalid} className="min-h-14 text-foreground" />
            break
          case "number":
            input = <Input inputMode="decimal" value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} disabled={!!f.retiredAt} aria-invalid={invalid} className="h-8 text-foreground tabular-nums" />
            break
          case "date":
            input = <Input type="date" value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} disabled={!!f.retiredAt} aria-invalid={invalid} className="h-8 text-foreground" />
            break
          case "yes_no":
            input = (
              <Select value={v === true ? "yes" : v === false ? "no" : "none"} onValueChange={(x) => set(f.key, x === "yes" ? true : x === "no" ? false : null)} disabled={!!f.retiredAt}>
                <SelectTrigger size="sm" className="w-full bg-card" aria-label={f.label} aria-invalid={invalid}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            )
            break
          case "choice":
            input = <SearchPick options={f.options.map((o) => ({ value: o, label: o }))} value={String(v ?? "")} onChange={(x) => set(f.key, x || null)} disabled={!!f.retiredAt} required={f.required} aria-label={f.label} />
            break
          case "multi_choice":
            input = <MultiPick options={f.options.map((o) => ({ value: o, label: o }))} values={Array.isArray(v) ? (v as string[]) : []} onChange={(x) => set(f.key, x)} disabled={!!f.retiredAt} aria-label={f.label} />
            break
          default:
            input = <Input value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} disabled={!!f.retiredAt} aria-invalid={invalid} className="h-8 text-foreground" />
        }
        return (
          <Field key={f.id} label={label} className={wide ? "col-span-full" : undefined}>
            {input}
            {f.help && <span className="text-[11px] text-muted-foreground">{f.help}</span>}
          </Field>
        )
      })}
    </>
  )
}

export const showValue = (v: unknown) => (isEmpty(v) ? null : Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v))

/** Label/value rows for a record page. */
export function CustomFieldRows({ fields, values }: { fields: CustomField[]; values?: CustomValues }) {
  return (
    <>
      {fields.map((f) => (
        <Row key={f.id} label={f.label}>
          {showValue(values?.[f.key])}
        </Row>
      ))}
    </>
  )
}
