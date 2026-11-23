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
