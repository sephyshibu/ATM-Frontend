import { CircleAlert, CircleCheck, Download, FileSpreadsheet, Info, Plus, Save, TriangleAlert, Upload } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchPick } from "@/components/common/search-pick"
import { api, useApi } from "@/lib/api"
import { downloadCsv, readSheets, type Sheet } from "@/lib/excel"
import { plural } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { FieldType, ImportCheck, ImportDone, ImportRowResult, ImportTarget, TargetChoice } from "@/lib/types"
import { cn } from "@/lib/utils"

import { attempt, useBusy } from "../settings/shared"

// Every Excel or CSV import goes through the same four steps:
//   1. Choose the file (and the sheet, and which row holds the column headings).
//   2. Map: for each field, pick the column it comes from. Columns are matched by heading where they can be; the
//      last mapping used for the same headings is remembered. A column with no field can become a new field.
//   3. Check: the server checks every row and nothing is written yet. Rejected rows show the exact reasons and can
//      be downloaded, fixed and imported again.
//   4. Import: the rows that passed are created; the rest are skipped and kept with the import.

export type ImportKind = "brands" | "products"

type Props = { open: boolean; onClose: () => void; kind: ImportKind; brand?: { id: string; name: string }; onImported: () => void }

const NONE = "__none__"
type NewType = FieldType | "usd"
const FIELD_TYPES: { value: NewType; label: string; factOnly?: boolean }[] = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "usd", label: "Amount (USD)", factOnly: true },
  { value: "date", label: "Date" },
  { value: "yes_no", label: "Yes / no" },
  { value: "choice", label: "One choice" },
  { value: "multi_choice", label: "Several choices" },
]
/** What an unmapped column can become: a field on the brand or its organisation, a knowledge-base fact, or a gate. */
type NewKind = "brand" | "organisation" | "product" | "fact" | "gate"
const NEW_KINDS: Record<NewKind, string> = { brand: "Brand field", organisation: "Organisation field", product: "Product field", fact: "Fact (knowledge base)", gate: "Gate" }
const FACT_GROUPS = [
  { value: "company", label: "Company facts" },
  { value: "asia", label: "Asia position" },
  { value: "regulatory", label: "Regulatory" },
  { value: "outreach", label: "Outreach" },
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")
/** The same headings, whatever their order. */
const sig = (headings: string[]) => [...new Set(headings.map(norm).filter(Boolean))].sort().join("|")

type SavedMapping = { id: string; name: string; headers: string[]; mapping: Record<string, string>; valueMaps?: ValueMaps }
/** Field key → { cell value (lower case) → the value it stands for; "" = leave empty }. */
type ValueMaps = Record<string, Record<string, string>>

const cellKey = (c: string) => c.trim().toLowerCase()
/** The choice a cell matches by itself: same name (any case), or a choice the cell starts with ("Low risk" → Low). */
function autoChoice(choices: TargetChoice[], cell: string) {
  const c = cellKey(cell)
  if (!c) return null
  const exact = choices.find((x) => x.value.toLowerCase() === c || x.label.toLowerCase() === c)
  if (exact) return exact.value
  const starts = choices.filter((x) => c.startsWith(`${x.value.toLowerCase()} `) || c.startsWith(`${x.value.toLowerCase()}-`))
  if (starts.length === 1) return starts[0].value
  const prefix = choices.filter((x) => x.value.toLowerCase().startsWith(c))
  return prefix.length === 1 ? prefix[0].value : null
}
const splitMulti = (cell: string) => cell.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean)

export function ImportWizard(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="flex max-h-[94dvh] flex-col gap-0 p-0 sm:max-w-[1040px]">{props.open && <Wizard {...props} />}</DialogContent>
    </Dialog>
  )
}

function Wizard({ onClose, kind, brand, onImported }: Props) {
  const { can } = useSession()
  const fieldsPath = `/records/import/${kind}/fields`
  const targets = useApi<ImportTarget[]>(fieldsPath)
  const checkPath = kind === "brands" ? "/records/import/brands/check" : `/records/brands/${brand?.id}/products/import/check`
  const importPath = kind === "brands" ? "/records/import/brands" : `/records/brands/${brand?.id}/products/import`
  const what = kind === "brands" ? "brands" : "products"

  const [step, setStep] = useState<"file" | "map" | "check" | "done">("file")
  const [fileName, setFileName] = useState("")
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [headerRow, setHeaderRow] = useState(1)
  const [fileError, setFileError] = useState("")
  const [mapping, setMapping] = useState<Record<string, number>>({})
  /** More columns for fields that take several (gate notes, long text): field key → its extra columns. */
  const [extra, setExtra] = useState<Record<string, number[]>>({})
  const [valueMaps, setValueMaps] = useState<ValueMaps>({})
  const [mode, setMode] = useState<"skip" | "update">("skip")
  const saved = useApi<SavedMapping[]>(`/records/import/${kind}/mappings`)
  const [applied, setApplied] = useState<string | null>(null)
  const [saveName, setSaveName] = useState<string | null>(null)
  const [check, setCheck] = useState<ImportCheck | null>(null)
  const [done, setDone] = useState<ImportDone | null>(null)
  /** The picked file itself, kept so the original can be stored in S3 with the import. */
  const picked = useRef<File | null>(null)
  const [kept, setKept] = useState<{ state: "saving" } | { state: "stored" } | { state: "failed"; reason: string } | null>(null)
  const [busy, run] = useBusy()
  const input = useRef<HTMLInputElement>(null)

  const rows = sheets[sheetIndex]?.rows ?? []
  const headers = (rows[headerRow - 1] ?? []).map((h, i) => h || `Column ${i + 1}`)
  /** Data rows with their row number in the sheet; fully empty rows are skipped. */
  const data = useMemo(
    () =>
      rows
        .slice(headerRow)
        .map((cells, i) => ({ row: headerRow + i + 1, cells }))
        .filter((r) => r.cells.some((c) => c !== "")),
    [rows, headerRow],
  )
  const storeKey = `atm.import.${kind}.${headers.map(norm).join("|")}`

  // Map columns to fields: the mapping last used for these headings, else by heading name.
  useEffect(() => {
    if (step !== "map" || !targets.data) return
    // A saved mapping made for the same headings wins; then the one last used in this browser.
    const sameHeadings = (saved.data ?? []).find((m) => sig(m.headers) === sig(headers))
    if (sameHeadings && applied === null) {
      applyMapping(sameHeadings)
      return
    }
    let remembered: Record<string, string> = {}
    try {
      remembered = JSON.parse(localStorage.getItem(storeKey) ?? "{}") as Record<string, string>
    } catch {
      remembered = {}
    }
    const current = mapping
    const next: Record<string, number> = {}
    const used = new Set<number>(Object.values(extra).flat())
    for (const t of targets.data!) {
      if (current[t.key] !== undefined && current[t.key] < headers.length) {
        next[t.key] = current[t.key]
        if (current[t.key] >= 0) used.add(current[t.key])
        continue
      }
      const fromSaved = headers.findIndex((h, i) => !used.has(i) && remembered[h] === t.key)
      const byName = headers.findIndex((h, i) => !used.has(i) && [t.label, ...t.aliases].some((a) => norm(a) === norm(h)))
      const col = fromSaved >= 0 ? fromSaved : byName
      next[t.key] = col
      if (col >= 0) used.add(col)
    }
    setMapping(next)
    // Columns remembered for a field that takes several: the ones after its first.
    if (!Object.keys(extra).length) {
      const more: Record<string, number[]> = {}
      headers.forEach((h, i) => {
        const key = remembered[h]
        const t = key ? targets.data!.find((x) => x.key === key) : undefined
        if (t?.joinable && next[key] >= 0 && next[key] !== i && !used.has(i)) more[key] = [...(more[key] ?? []), i]
      })
      if (Object.keys(more).length) setExtra(more)
    }
    // Runs when the step, the headings or the field list change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, targets.data, saved.data, storeKey])

  /** Uses a saved mapping: its headings that are in this file go to their fields; everything else is unmapped. */
  const applyMapping = (m: SavedMapping) => {
    const next: Record<string, number> = {}
    const more: Record<string, number[]> = {}
    for (const t of targets.data ?? []) next[t.key] = -1
    for (const [heading, key] of Object.entries(m.mapping)) {
      const col = headers.findIndex((h) => norm(h) === norm(heading))
      if (col < 0) continue
      // A field that takes several columns keeps them all; the first is its main column.
      if (next[key] >= 0 && (targets.data ?? []).find((t) => t.key === key)?.joinable) more[key] = [...(more[key] ?? []), col]
      else next[key] = col
    }
    setMapping(next)
    setExtra(more)
    setValueMaps(m.valueMaps ?? {})
    setApplied(m.name)
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setFileError("")
    try {
      const read = await readSheets(file)
      const first = read.findIndex((s) => s.rows.length > 1)
      if (first < 0) throw new Error("The file has no rows under the headings.")
      setSheets(read)
      setSheetIndex(first)
      setHeaderRow(Math.max(1, read[first].rows.findIndex((r) => r.some((c) => c !== "")) + 1))
      setFileName(file.name)
      picked.current = file
      setMapping({})
      setExtra({})
      setValueMaps({})
      setApplied(null)
    } catch (e) {
      setFileError(e instanceof Error ? e.message : String(e))
      setSheets([])
    }
  }

  const missing = (targets.data ?? []).filter((t) => t.required && (mapping[t.key] ?? -1) < 0)
  const byKey = new Map((targets.data ?? []).map((t) => [t.key, t]))

  /** A cell as it's sent: for fields with set values, the value it's mapped to (or matches by itself). */
  const mapCell = (t: ImportTarget | undefined, cell: string) => {
    if (!t?.choices || !cell.trim()) return cell
    const one = (c: string) => {
      const chosen = valueMaps[t.key]?.[cellKey(c)]
      if (chosen !== undefined) return chosen
      return autoChoice(t.choices!, c) ?? c
    }
    return t.multi ? splitMulti(cell).map(one).filter(Boolean).join(", ") : one(cell)
  }

  /** A field's columns: its main one, then any extra ones (fields that take several). */
  const colsOf = (k: string) => [mapping[k] ?? -1, ...(extra[k] ?? [])].filter((c) => c >= 0)
  /** A field's cell for one row. Several columns are joined, each line starting with its column's name. */
  const cellFor = (k: string, cells: string[]) => {
    const cols = colsOf(k)
    if (cols.length <= 1) return mapCell(byKey.get(k), cells[cols[0]] ?? "")
    return cols
      .map((c) => [headers[c].replace(/\s+/g, " ").trim(), (cells[c] ?? "").trim()] as const)
      .filter(([, v]) => v)
      .map(([h, v]) => `${h}: ${v}`)
      .join("\n")
  }
  const mappedKeys = () => Object.keys(mapping).filter((k) => colsOf(k).length)

  const payload = () => ({
    fileName,
    ...(kind === "brands" ? { mode } : {}),
    mapping: Object.fromEntries(mappedKeys().flatMap((k) => colsOf(k).map((c) => [headers[c], k]))),
    rows: data.map((r) => ({ row: r.row, values: Object.fromEntries(mappedKeys().map((k) => [k, cellFor(k, r.cells)])) })),
  })

  /**
   * Puts a column on a field. Most fields take one column (a field already used moves here); notes and long text
   * take several, joined. "" = don't import the column.
   */
  const setColumn = (col: number, key: string) => {
    const nextMap = { ...mapping }
    const nextExtra: Record<string, number[]> = Object.fromEntries(Object.entries(extra).map(([k, cs]) => [k, cs.filter((c) => c !== col)]))
    for (const [k, c] of Object.entries(nextMap))
      if (c === col) {
        // Its first extra column (if any) becomes the field's main column.
        const [first, ...rest] = nextExtra[k] ?? []
        nextMap[k] = first ?? -1
        nextExtra[k] = rest
      }
    if (key) {
      const joinable = byKey.get(key)?.joinable
      if (joinable && (nextMap[key] ?? -1) >= 0) nextExtra[key] = [...(nextExtra[key] ?? []), col]
      else {
        // The field moves to this column; for one that takes several, its old columns go too.
        nextMap[key] = col
        nextExtra[key] = []
      }
    }
    setMapping(nextMap)
    setExtra(nextExtra)
  }
  /** The group titles above the heading row ("RESEARCH", "ICP GATES"…), carried across merged cells. */
  const groupRow = useMemo(() => {
    const above = headerRow > 1 ? (rows[headerRow - 2] ?? []) : []
    let last = ""
    return headers.map((_, i) => (above[i] ? (last = above[i].split(/\s[—–-]\s/)[0].trim()) : last))
  }, [rows, headerRow, headers])

  const runCheck = async () => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(payload().mapping))
    } catch {
      // The browser may refuse storage; the mapping just isn't remembered.
    }
    const r = await run(() => attempt(() => api.post<ImportCheck>(checkPath, payload())))
    if (r) {
      setCheck(r)
      setStep("check")
    }
  }

  const runImport = async () => {
    const r = await run(() => attempt(() => api.post<ImportDone>(importPath, payload()), (d) => `${plural(d.imported, kind === "brands" ? "brand" : "product")} imported.`))
    if (r) {
      setDone(r)
      setStep("done")
      onImported()
      void keepFile(r.batchId)
    }
  }

  /** Sends the original file to be kept in S3 with the import. A failure here never undoes the import. */
  const keepFile = async (batchId: string) => {
    const file = picked.current
    if (!file || !batchId) return
    setKept({ state: "saving" })
    const form = new FormData()
    form.append("file", file, file.name)
    try {
      await api.upload(`/records/imports/${batchId}/file`, form)
      setKept({ state: "stored" })
    } catch (e) {
      setKept({ state: "failed", reason: e instanceof Error ? e.message : "The file couldn't be stored." })
    }
  }

  const downloadKept = async () => {
    if (!done) return
    const r = await attempt(() => api.get<{ url: string }>(`/records/imports/${done.batchId}/file`))
    if (r) window.location.assign(r.url)
  }

  const rejectedCsv = (results: ImportRowResult[]) => {
    const bad = new Map(results.filter((r) => !r.ok).map((r) => [r.row, r.reasons.join(" | ")]))
    downloadCsv(
      fileName.replace(/\.(xlsx|csv|txt)$/i, "") + " - rejected rows.csv",
      [["Sheet row", ...headers, "Why it was rejected"], ...data.filter((r) => bad.has(r.row)).map((r) => [String(r.row), ...r.cells, bad.get(r.row) ?? ""])],
    )
  }

  const template = () => downloadCsv(`${what} import template.csv`, [(targets.data ?? []).map((t) => t.label + (t.required ? " *" : ""))])

  const steps = ["Choose file", "Map columns", "Check", "Import"]
  const at = { file: 0, map: 1, check: 2, done: 3 }[step]

  return (
    <>
      <div className="flex flex-col gap-3 border-b px-6 py-4">
        <div className="flex flex-col gap-1">
          <DialogTitle>{kind === "brands" ? "Import brands" : `Import products into ${brand?.name}`}</DialogTitle>
          <DialogDescription>
            {kind === "brands"
              ? "Each row is a brand. Brands with the same organisation name go under one organisation; new organisations are created."
              : "Each row is a product of this brand."}{" "}
            Nothing is saved until the last step.
          </DialogDescription>
        </div>
        <ol className="flex flex-wrap gap-1.5 text-xs">
          {steps.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-0.5", i === at ? "border-primary/40 bg-primary/10 font-semibold text-primary" : i < at ? "text-foreground" : "text-muted-foreground")}>
              <span className="tabular-nums">{i + 1}</span> {s}
            </li>
          ))}
        </ol>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {step === "file" && (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                void pickFile(e.dataTransfer.files[0])
              }}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center hover:bg-muted/50"
            >
              <Upload className="size-6 text-muted-foreground" />
              <span className="font-medium">{fileName ? fileName : "Choose an Excel (.xlsx) or CSV file"}</span>
              <span className="text-xs text-muted-foreground">Or drop it here. Up to 5,000 rows and 20 MB.</span>
            </button>
            <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0] ?? undefined)} />
            {fileError && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                {fileError}
              </p>
            )}
            {sheets.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Sheet
                  <Select
                    value={String(sheetIndex)}
                    onValueChange={(v) => {
                      setSheetIndex(Number(v))
                      setHeaderRow(1)
                      setMapping({})
                      setExtra({})
                      setApplied(null)
                    }}
                  >
                    <SelectTrigger size="sm" className="w-full bg-card text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sheets.map((s, i) => (
                        <SelectItem key={s.name} value={String(i)}>
                          {s.name} ({plural(Math.max(0, s.rows.length - 1), "row")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Column headings are on row
                  <Input type="number" min={1} max={Math.max(1, rows.length)} value={headerRow} onChange={(e) => setHeaderRow(Math.min(Math.max(1, Number(e.target.value) || 1), Math.max(1, rows.length)))} className="h-8 text-foreground" />
                </label>
                <div className="col-span-2 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Headings found: {headers.length} columns, {plural(data.length, "row")} under them.
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {headers.slice(0, 40).map((h, i) => (
                      <span key={`${h}${i}`} className="rounded border bg-muted/40 px-1.5 py-px text-xs">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <button type="button" onClick={template} disabled={!targets.data} className="flex w-fit items-center gap-1.5 text-xs text-primary hover:underline">
              <FileSpreadsheet className="size-3.5" /> Download a template with every field
            </button>
          </div>
        )}

        {step === "map" && (
          <div className="flex flex-col gap-4">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              Your file's columns are on the left. Pick the ATM field each one goes to, or leave it as Don't import. Fields marked <span className="font-semibold text-foreground">*</span> are needed. For fields with set values (lists, choices, gates), match each value in the column.
            </p>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <span className="text-sm">Saved mapping</span>
              <Select
                value={applied ? `name:${applied}` : NONE}
                onValueChange={(v) => {
                  const m = (saved.data ?? []).find((x) => `name:${x.name}` === v)
                  if (m) applyMapping(m)
                }}
              >
                <SelectTrigger size="sm" className="w-64 bg-card" aria-label="Saved mapping">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} disabled>
                    {saved.data?.length ? "Pick a saved mapping" : "No saved mappings yet"}
                  </SelectItem>
                  {(saved.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={`name:${m.name}`}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {saveName === null ? (
                <Button size="sm" variant="outline" onClick={() => setSaveName(applied ?? "")}>
                  <Save /> Save this mapping
                </Button>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Input autoFocus value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. Brand Register v3" className="h-8 w-56 text-foreground" />
                  <Button
                    size="sm"
                    disabled={!saveName.trim()}
                    onClick={async () => {
                      const name = saveName.trim()
                      const r = await attempt(() => api.post(`/records/import/${kind}/mappings`, { name, headers, mapping: payload().mapping, valueMaps }), `Mapping saved as ${name}. Files with the same headings will use it.`)
                      if (r) {
                        setApplied(name)
                        setSaveName(null)
                        void saved.reload()
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSaveName(null)}>
                    Cancel
                  </Button>
                </span>
              )}
              {applied && <span className="text-xs text-muted-foreground">Using {applied}. Saving under the same name replaces it.</span>}
            </div>
            {kind === "brands" && (
              <div className="flex flex-col gap-1.5 rounded-lg border px-3 py-2">
                <span className="text-sm font-medium">Brands already in Records (same website, or the same name in the same organisation when there's no website)</span>
                <label className="flex items-start gap-2 text-sm">
                  <input type="radio" name="mode" className="mt-1" checked={mode === "skip"} onChange={() => setMode("skip")} />
                  <span>
                    Skip them <span className="text-muted-foreground">: they're listed as rejected, nothing changes.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="radio" name="mode" className="mt-1" checked={mode === "update"} onChange={() => setMode("update")} />
                  <span>
                    Update them from the file <span className="text-muted-foreground">: filled cells replace their values, empty cells change nothing, new contacts and tags are added. Every change goes into the brand's history.</span>
                  </span>
                </label>
              </div>
            )}
            {targets.error && <p className="text-destructive">{targets.error}</p>}
            {missing.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-sm text-[#93370d]">
                <span className="font-medium">Needed fields with no column yet</span>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {missing.map((t) => (
                    <label key={t.key} className="flex items-center gap-2">
                      {t.label}
                      <SearchPick options={headers.map((h, i) => ({ value: String(i), label: h.replace(/\s+/g, " ") }))} value="" onChange={(v) => v && setColumn(Number(v), t.key)} placeholder="Pick its column" aria-label={`Column for ${t.label}`} className="w-52" />
                    </label>
                  ))}
                </div>
                <span className="text-xs">If your file doesn't have it, Settings → Fields can make the field optional.</span>
              </div>
            )}
            {targets.error && <p className="text-destructive">{targets.error}</p>}
            <ColumnTable
              headers={headers}
              groups={groupRow}
              data={data.map((r) => r.cells)}
              targets={targets.data ?? []}
              mapping={mapping}
              extra={extra}
              onSetColumn={setColumn}
              valueMaps={valueMaps}
              onSetValue={(key, cell, value) => setValueMaps((v) => ({ ...v, [key]: { ...(v[key] ?? {}), [cellKey(cell)]: value } }))}
              canAdd={can("settings.edit")}
              kinds={kind === "brands" ? ["brand", "organisation", "fact", "gate"] : ["product"]}
              reloadTargets={async () => {
                await targets.reload()
              }}
            />
          </div>
        )}

        {step === "check" && check && <CheckResults check={check} what={what} onDownload={() => rejectedCsv(check.rows)} />}

        {step === "done" && done && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CircleCheck className="size-8 text-[#17b26a]" />
            <p className="text-base font-semibold">
              {kind === "brands"
                ? `${plural(done.newBrands ?? 0, "new brand")}${done.updates ? ` and ${plural(done.updates, "updated brand")}` : ""}${done.newOrganisations ? `, ${plural(done.newOrganisations, "new organisation")}` : ""}${done.contacts ? `, ${plural(done.contacts, "new contact")}` : ""}.`
                : `${plural(done.imported, "product")} imported.`}
              {done.leadsOpened ? ` ${plural(done.leadsOpened, "lead")} opened at Register.` : ""}
              {done.facts ? ` ${plural(done.facts, "fact")} entered for checking.` : ""}
              {done.dossierLinks ? ` ${plural(done.dossierLinks, "dossier link")} added; the files are being fetched into storage.` : ""}
            </p>
            {kept && (
              <p className={cn("flex items-center gap-1.5 text-xs", kept.state === "failed" ? "text-[#b54708]" : "text-muted-foreground")}>
                {kept.state === "saving" && "Keeping the original file in secure storage…"}
                {kept.state === "stored" && (
                  <>
                    The original file is kept in secure storage with this import.
                    <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={downloadKept}>
                      Download it
                    </button>
                  </>
                )}
                {kept.state === "failed" && (
                  <>
                    <TriangleAlert className="size-3.5" /> The import is complete, but the original file wasn't kept: {kept.reason}
                    <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => void keepFile(done.batchId)}>
                      Try again
                    </button>
                  </>
                )}
              </p>
            )}
            {done.rejected > 0 && (
              <>
                <p className="text-muted-foreground">{plural(done.rejected, "row")} were not imported. Download them with the reasons, fix them, and import that file.</p>
                <Button variant="outline" size="sm" onClick={() => rejectedCsv(done.rows)}>
                  <Download /> Download rejected rows
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-6 py-3">
        <span className="text-xs text-muted-foreground">
          {step === "map" && missing.length > 0 && `Map ${missing.map((t) => t.label).join(", ")} to continue.`}
          {step === "check" && check && `${check.ready} ready · ${check.rejected} rejected`}
        </span>
        <div className="flex gap-2">
          {step === "done" ? (
            <Button onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={step === "file" ? onClose : () => setStep(step === "check" ? "map" : "file")}>
                {step === "file" ? "Cancel" : "Back"}
              </Button>
              {step === "file" && (
                <Button disabled={!data.length || !targets.data} onClick={() => setStep("map")}>
                  Next: map columns
                </Button>
              )}
              {step === "map" && (
                <Button disabled={busy || missing.length > 0} onClick={runCheck}>
                  {busy ? "Checking…" : `Check ${plural(data.length, "row")}`}
                </Button>
              )}
              {step === "check" && check && (
                <Button disabled={busy || check.ready === 0} onClick={runImport}>
                  {busy ? "Importing…" : check.rejected ? `Import ${check.ready}, skip ${check.rejected}` : `Import ${plural(check.ready, kind === "brands" ? "brand" : "product")}`}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * One row per column of the file, in the file's order: what it holds, and the ATM field it goes to (or "Don't
 * import"). A column can also be added here as a new field. For fields with set values (lists, choices, gates,
 * yes/no) each different value in the column is matched to one of them; a value that doesn't match can be matched
 * by hand, left empty, or added to the list.
 */
function ColumnTable(p: {
  headers: string[]
  groups: string[]
  data: string[][]
  targets: ImportTarget[]
  mapping: Record<string, number>
  extra: Record<string, number[]>
  onSetColumn: (col: number, key: string) => void
  valueMaps: ValueMaps
  onSetValue: (key: string, cell: string, value: string) => void
  canAdd: boolean
  kinds: NewKind[]
  reloadTargets: () => Promise<void>
}) {
  const [adding, setAdding] = useState<number | null>(null)
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const keyOf = (col: number) => Object.entries(p.mapping).find(([, c]) => c === col)?.[0] ?? Object.entries(p.extra).find(([, cs]) => cs.includes(col))?.[0] ?? ""
  const usedBy = (key: string) => p.mapping[key] ?? -1
  const joinable = new Set(p.targets.filter((t) => t.joinable).map((t) => t.key))
  /** The other columns going into the same field, for fields that take several. */
  const siblings = (key: string, col: number) => [p.mapping[key] ?? -1, ...(p.extra[key] ?? [])].filter((c) => c >= 0 && c !== col)
  const options = [
    ...(p.canAdd ? [{ value: "__new__", label: "+ Add as a new field…", hint: "Brand, organisation, fact or gate" }] : []),
    ...p.targets.map((t) => ({ value: t.key, label: `${t.label}${t.required ? " *" : ""}`, hint: t.group })),
  ]
  const cols = "minmax(0,1.15fr) minmax(0,1fr) 112px"
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: cols }}>
        <span>Column in your file</span>
        <span>Field in ATM</span>
        <span>Values</span>
      </div>
      <ul className="divide-y">
        {p.headers.map((h, col) => {
          const values = p.data.map((r) => r[col] ?? "").filter((c) => c.trim() !== "")
          const key = keyOf(col)
          const t = p.targets.find((x) => x.key === key)
          const distinct = [...new Map((t?.multi ? values.flatMap(splitMulti) : values).map((v) => [cellKey(v), v.trim()])).values()]
          const unmatched = t?.choices ? distinct.filter((v) => p.valueMaps[t.key]?.[cellKey(v)] === undefined && !autoChoice(t.choices!, v)) : []
          const showGroup = p.groups[col] && p.groups[col] !== p.groups[col - 1]
          return (
            <li key={`${h}${col}`} className={cn(!values.length && "opacity-60")}>
              {showGroup && <div className="border-b bg-muted/20 px-3 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{p.groups[col]}</div>}
              <div className="grid items-start gap-3 px-3 py-2" style={{ gridTemplateColumns: cols }}>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium break-words">{h.replace(/\s+/g, " ")}</span>
                  <span className="truncate text-xs text-muted-foreground">{values.length ? values.slice(0, 3).join(" · ") : "(empty in every row)"}</span>
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <SearchPick
                    options={options.map((o) =>
                      o.value === "__new__" || usedBy(o.value) < 0 || usedBy(o.value) === col
                        ? o
                        : { ...o, hint: joinable.has(o.value) ? `${o.hint} · also from "${p.headers[usedBy(o.value)].replace(/\s+/g, " ")}" (joined)` : `${o.hint} · now from "${p.headers[usedBy(o.value)].replace(/\s+/g, " ")}"` },
                    )}
                    value={key}
                    onChange={(v) => {
                      if (v === "__new__") return setAdding(col)
                      p.onSetColumn(col, v)
                    }}
                    placeholder="Don't import"
                    aria-label={`Field for ${h}`}
                    className={cn(!key && "text-muted-foreground")}
                  />
                  {t && siblings(t.key, col).length > 0 ? (
                    <span className="text-xs text-[#175cd3]">Joined with {siblings(t.key, col).map((c) => `"${p.headers[c].replace(/\s+/g, " ")}"`).join(", ")}: each line starts with its column's name.</span>
                  ) : (
                    t?.hint && <span className="text-xs text-muted-foreground">{t.hint}</span>
                  )}
                </span>
                <span className="text-xs">
                  {t?.choices && distinct.length > 0 ? (
                    <button type="button" className={cn("rounded px-1.5 py-0.5 text-left hover:bg-muted", unmatched.length ? "text-[#b54708]" : "text-muted-foreground")} onClick={() => setOpen((o) => ({ ...o, [col]: !o[col] }))}>
                      {unmatched.length ? `${unmatched.length} of ${distinct.length} to match` : `${distinct.length} matched`} {open[col] ? "▴" : "▾"}
                    </button>
                  ) : key ? (
                    <span className="text-muted-foreground">Imported as written</span>
                  ) : null}
                </span>
              </div>
              {adding === col && (
                <ul className="border-t bg-muted/20">
                  <NewFieldRow
                    header={h}
                    values={values}
                    canAdd={p.canAdd}
                    kinds={p.kinds}
                    onAdded={async (targetKey) => {
                      await p.reloadTargets()
                      p.onSetColumn(col, targetKey)
                      setAdding(null)
                    }}
                  />
                </ul>
              )}
              {t?.choices && (open[col] || (unmatched.length > 0 && open[col] !== false)) && distinct.length > 0 && <ValueMatcher target={t} cells={distinct} valueMaps={p.valueMaps} onSetValue={p.onSetValue} canAdd={p.canAdd} targets={p.targets} reloadTargets={p.reloadTargets} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Each different value in a column, matched to one of the field's set values (or left empty, or added to the list). */
function ValueMatcher({ target: t, cells, valueMaps, onSetValue, canAdd, targets, reloadTargets }: { target: ImportTarget; cells: string[]; valueMaps: ValueMaps; onSetValue: (key: string, cell: string, value: string) => void; canAdd: boolean; targets: ImportTarget[]; reloadTargets: () => Promise<void> }) {
  const [parentFor, setParentFor] = useState<string | null>(null)
  // A new sub-category needs its category: taken from the category field's values.
  const parentKey = t.addTo?.kind === "list" ? t.addTo.parentFrom : undefined
  const parents = parentKey ? (targets.find((x) => x.key === parentKey)?.choices ?? []) : []
  const add = async (cell: string, parentId?: string) => {
    const label = cell.trim()
    const to = t.addTo
    if (!to) return
    const ok =
      to.kind === "list"
        ? await attempt(() => api.post(`/settings/lists/${to.listKey}/values`, { label, ...(parentId ? { parentId } : {}) }), `"${label}" added to the list.`)
        : to.kind === "fact"
          ? await attempt(() => api.patch(`/knowledge/definitions/${to.key}`, { options: [...(t.choices ?? []).map((c) => c.value), label] }), `"${label}" added as a choice.`)
          : await attempt(() => api.patch(`/records/fields/${to.id}`, { options: [...(t.choices ?? []).map((c) => c.value), label] }), `"${label}" added as a choice.`)
    if (ok) {
      await reloadTargets()
      onSetValue(t.key, cell, label)
      setParentFor(null)
    }
  }
  return (
    <div className="border-t bg-muted/20 px-3 py-2">
      <div className="mb-1.5 text-xs text-muted-foreground">
        Match each value in this column to one of <span className="font-medium text-foreground">{t.label}</span>&apos;s values. Values left unmatched are {t.required ? "rejected" : "left empty with a warning"}.
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {cells.map((cell) => {
          const chosen = valueMaps[t.key]?.[cellKey(cell)]
          const auto = autoChoice(t.choices ?? [], cell)
          const value = chosen !== undefined ? (chosen === "" ? "__empty__" : chosen) : (auto ?? "")
          const opts = [
            ...(t.choices ?? []).map((c) => ({ value: c.value, label: c.label, hint: c.parent ?? undefined })),
            { value: "__empty__", label: "Leave empty", hint: "" },
            ...(canAdd && t.addTo && !(t.choices ?? []).some((c) => c.value.toLowerCase() === cell.trim().toLowerCase()) ? [{ value: "__add__", label: `+ Add "${cell.trim()}" to the list`, hint: "" }] : []),
          ]
          return (
            <li key={cell} className="flex flex-col gap-1">
              <span className="flex items-center gap-2">
                <span className={cn("min-w-0 flex-1 truncate text-sm", !chosen && !auto && "text-[#b54708]")} title={cell}>
                  {cell}
                </span>
                <span className="text-muted-foreground">→</span>
                <SearchPick
                  options={opts}
                  value={value}
                  onChange={(v) => {
                    if (v === "__add__") {
                      if (t.addTo?.kind === "list" && t.addTo.parentFrom) return setParentFor(cell)
                      return void add(cell)
                    }
                    onSetValue(t.key, cell, v === "__empty__" ? "" : v)
                  }}
                  placeholder="Not matched"
                  aria-label={`Value for ${cell}`}
                  className="w-48"
                />
              </span>
              {parentFor === cell && (
                <span className="flex items-center gap-2 pl-2 text-xs">
                  Under which category?
                  <SearchPick options={parents.filter((c) => c.id).map((c) => ({ value: c.id!, label: c.label }))} value="" onChange={(id) => id && void add(cell, id)} placeholder="Pick the category" aria-label="Category for the new sub-category" className="w-48" />
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** A column with no field: add it as a new field, then it maps itself. */
/** A guess at a column's type from its values. */
function guessType(header: string, values: string[], kind: NewKind): NewType {
  const vals = values.map((v) => v.trim()).filter(Boolean)
  const distinct = [...new Set(vals.map((v) => v.toLowerCase()))]
  if (kind === "fact" && /revenue|usd|turnover|sales/i.test(header)) return "usd"
  if (vals.length && vals.every((v) => /^-?[\d,.]+$/.test(v))) return "number"
  if (vals.length && vals.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))) return "date"
  if (distinct.length && distinct.every((v) => ["yes", "no", "y", "n", "true", "false"].includes(v))) return "yes_no"
  if (vals.length >= 3 && distinct.length <= 8 && vals.every((v) => v.length <= 40)) return "choice"
  return vals.some((v) => v.length > 80 || v.includes("\n")) ? "long_text" : "text"
}

/**
 * A column that isn't mapped: add it as a new field right here (Settings rights needed), then it's mapped to it.
 * Brand imports can add a brand or organisation field, a knowledge-base fact or a gate; product imports a product
 * field. Choices are filled from the column's own values.
 */
function NewFieldRow({ header, values, canAdd, kinds, onAdded }: { header: string; values: string[]; canAdd: boolean; kinds: NewKind[]; onAdded: (targetKey: string) => Promise<void> }) {
  const clean = header.replace(/\s+/g, " ").trim()
  const looksLikeGate = /^gate\b/i.test(clean) && kinds.includes("gate")
  const [kind, setKind] = useState<NewKind>(looksLikeGate ? "gate" : kinds[0])
  const [type, setType] = useState<NewType>(guessType(clean, values, kinds[0]))
  const [group, setGroup] = useState("company")
  const [stage, setStage] = useState<"desk" | "call">("desk")
  const [busy, run] = useBusy()
  const sample = values[0] ?? ""
  // "Gate 04 No in-house Asia cap." → "No in-house Asia cap."
  const name = kind === "gate" ? clean.replace(/^gate\s*\d*\s*[:.\-–]?\s*/i, "") || clean : clean
  const options = [...new Map(values.flatMap((v) => (type === "multi_choice" ? v.split(/[,;\n]+/) : [v])).map((v) => v.trim()).filter((v) => v && v.length <= 80).map((v) => [v.toLowerCase(), v])).values()].slice(0, 50)
  const types = FIELD_TYPES.filter((t) => kind === "fact" || !t.factOnly)
  const add = async () => {
    const isChoice = type === "choice" || type === "multi_choice"
    if (isChoice && options.length < 2) return void attempt(() => Promise.reject(new Error("A choice field needs at least two different values in the column.")))
    if (kind === "gate") {
      const g = await run(() => attempt(() => api.post<{ code: string; name: string }>("/gates", { name, checks: "", stage }), (g) => `Gate ${g.code} ${g.name} added.`))
      if (g) await onAdded(`gate.${g.code}`)
    } else if (kind === "fact") {
      const f = await run(() => attempt(() => api.post<{ key: string }>("/knowledge/definitions", { label: name, groupCode: group, type, ...(isChoice ? { options } : {}) }), `${name} added to the knowledge base.`))
      if (f) await onAdded(`fact.${f.key}`)
    } else {
      const f = await run(() => attempt(() => api.post<{ key: string }>("/records/fields", { entityType: kind, label: name, type, ...(isChoice ? { options } : {}) }), `${name} added as ${NEW_KINDS[kind].toLowerCase()}.`))
      if (f) await onAdded(kind === "organisation" ? `org.custom.${f.key}` : `custom.${f.key}`)
    }
  }
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="flex min-w-0 flex-1 basis-56 flex-col">
        <span className="truncate font-medium">{clean}</span>
        {sample && <span className="truncate text-xs text-muted-foreground">e.g. {sample}</span>}
      </span>
      {canAdd && (
        <>
          {kinds.length > 1 && (
            <Select
              value={kind}
              onValueChange={(v) => {
                setKind(v as NewKind)
                setType(guessType(clean, values, v as NewKind))
              }}
            >
              <SelectTrigger size="sm" className="w-44 bg-card" aria-label={`Add ${clean} as`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((k) => (
                  <SelectItem key={k} value={k}>
                    {NEW_KINDS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {kind === "gate" ? (
            <Select value={stage} onValueChange={(v) => setStage(v as "desk" | "call")}>
              <SelectTrigger size="sm" className="w-36 bg-card" aria-label={`When ${clean} is checked`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desk">Desk gate</SelectItem>
                <SelectItem value="call">Call gate</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Select value={type} onValueChange={(v) => setType(v as NewType)}>
              <SelectTrigger size="sm" className="w-36 bg-card" aria-label={`Type for ${clean}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {kind === "fact" && (
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger size="sm" className="w-36 bg-card" aria-label={`Group for ${clean}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FACT_GROUPS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={add} title={(type === "choice" || type === "multi_choice") && kind !== "gate" ? `Choices: ${options.join(", ")}` : undefined}>
            <Plus /> Add
          </Button>
        </>
      )}
      {canAdd && (type === "choice" || type === "multi_choice") && kind !== "gate" && <span className="w-full text-xs text-muted-foreground">Choices from the column: {options.join(", ") || "none"}</span>}
    </li>
  )
}

/** The check: how many rows are ready, and every rejected row with its exact reasons. */
function CheckResults({ check, what, onDownload }: { check: ImportCheck; what: string; onDownload: () => void }) {
  const [show, setShow] = useState<"rejected" | "ready" | "notes">(check.rejected ? "rejected" : "ready")
  const withNotes = check.rows.filter((r) => r.ok && r.warnings.length)
  const list = show === "rejected" ? check.rows.filter((r) => !r.ok) : show === "notes" ? withNotes : check.rows.filter((r) => r.ok)
  const tabs: { key: typeof show; label: string; n: number }[] = [
    { key: "rejected", label: "Rejected", n: check.rejected },
    { key: "ready", label: "Ready", n: check.ready },
    { key: "notes", label: "Ready, with notes", n: withNotes.length },
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Rows checked" value={check.total} />
        <Stat
          label="Ready to import"
          value={check.ready}
          tone="good"
          hint={
            check.newBrands !== undefined
              ? [`${check.newBrands} new`, check.updates ? `${check.updates} updates` : "", check.newOrganisations ? plural(check.newOrganisations, "new organisation") : "", check.contacts ? plural(check.contacts, "contact") : "", check.facts ? plural(check.facts, "fact") : "", check.dossierLinks ? plural(check.dossierLinks, "dossier link") : ""].filter(Boolean).join(" · ")
              : undefined
          }
        />
        <Stat label="Rejected" value={check.rejected} tone={check.rejected ? "bad" : undefined} hint={check.rejected ? "Skipped on import" : undefined} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.key} type="button" onClick={() => setShow(t.key)} className={cn("rounded-md px-2.5 py-1 text-sm", show === t.key ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted")}>
              {t.label} ({t.n})
            </button>
          ))}
        </div>
        {check.rejected > 0 && (
          <Button size="sm" variant="outline" onClick={onDownload}>
            <Download /> Download rejected rows with reasons
          </Button>
        )}
      </div>
      {list.length ? (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {list.slice(0, 500).map((r) => (
            <li key={r.row} className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 px-3 py-2">
              <span className="text-xs text-muted-foreground tabular-nums">Row {r.row}</span>
              <div className="flex min-w-0 flex-col gap-1">
                {r.ok && (
                  <span className="flex items-center gap-2 font-medium">
                    {r.action && <span className={cn("rounded border px-1.5 text-[11px] font-normal", r.action === "update" ? "border-[#d1e9ff] bg-[#eff8ff] text-[#175cd3]" : "border-[#abefc6] bg-[#ecfdf3] text-[#067647]")}>{r.action === "update" ? "Update" : "New"}</span>}
                    {r.summary}
                  </span>
                )}
                {r.reasons.map((m, i) => (
                  <span key={i} className="flex items-start gap-1.5 text-sm">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    {m}
                  </span>
                ))}
                {r.warnings.map((m, i) => (
                  <span key={i} className="flex items-start gap-1.5 text-xs text-[#93370d]">
                    <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                    {m}
                  </span>
                ))}
              </div>
            </li>
          ))}
          {list.length > 500 && <li className="px-3 py-2 text-xs text-muted-foreground">Showing the first 500 of {list.length}. Download the file to see them all.</li>}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">{show === "rejected" ? `No rejected rows: every ${what.replace(/s$/, "")} is ready.` : "Nothing here."}</p>
      )}
    </div>
  )
}

function Stat({ label, value, tone, hint }: { label: string; value: number; tone?: "good" | "bad"; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xl font-semibold tabular-nums", tone === "good" && "text-[#067647]", tone === "bad" && "text-destructive")}>{value.toLocaleString("en-US")}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
