import { useApi } from "./api"
import type { RecordOptions } from "./types"

// Helpers the Records screens share: the form choices, and how codes, countries, names and money read.

/** Lists, countries and owners for the Records forms. Loaded once per screen. */
export const useRecordOptions = () => useApi<RecordOptions>("/records/options")

const regions = new Intl.DisplayNames(["en"], { type: "region" })

export const countryName = (code: string | null | undefined) => (code ? (regions.of(code) ?? code) : "")

/** The name of a list value, even a retired one; the code itself if unknown. */
export const optionLabel = (options: RecordOptions | undefined, list: keyof RecordOptions["lists"], code: string | null | undefined) => {
  if (!code) return ""
  const v = options?.lists[list].find((o) => o.code === code)
  return v ? v.label : code
}

export const personName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim()

/** USD 12,500,000 → "USD 12.5M". */
export const usdShort = (n: number | null | undefined) => {
  if (n === null || n === undefined) return ""
  if (n >= 1_000_000_000) return `USD ${+(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `USD ${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `USD ${+(n / 1_000).toFixed(0)}K`
  return `USD ${n}`
}

export const siteUrl = (domain: string) => `https://${domain}`

/** "USD 5M–7M" for a range, "USD 12.5M" for one amount. */
export const usdRange = (min: number | null | undefined, max: number | null | undefined) => (min == null ? "" : max != null && max !== min ? `${usdShort(min)}–${usdShort(max).replace("USD ", "")}` : usdShort(min))

type RecordKind = "organisation" | "brand" | "product" | "person"
const DEFAULT_REQUIRED: Record<RecordKind, string[]> = { organisation: [], brand: ["website", "category", "subCategory"], product: [], person: ["email"] }

/** The built-in fields of a record type that are required now (Settings → Fields). */
export const requiredSet = (options: RecordOptions | undefined, kind: RecordKind) => new Set(options?.required?.[kind] ?? DEFAULT_REQUIRED[kind])

const blank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0)

/**
 * The first required field left empty, as a message. On an edit a field counts only if it had a value before, so
 * a record saved before the field became required can still be edited (the server applies the same rule).
 */
export function missingBuiltIn(required: Set<string>, fields: { key: string; label: string; value: unknown; before?: unknown }[], isEdit: boolean) {
  const f = fields.find((x) => required.has(x.key) && blank(x.value) && (!isEdit || !blank(x.before)))
  return f ? `${f.label} is required.` : undefined
}
