import { CircleAlert, CircleCheck, Download, FileSpreadsheet, Info, Plus, TriangleAlert, Upload } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, useApi } from "@/lib/api"
import { downloadCsv, readSheets, type Sheet } from "@/lib/excel"
import { plural } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { FieldType, ImportCheck, ImportDone, ImportRowResult, ImportTarget } from "@/lib/types"
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
const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "yes_no", label: "Yes / no" },
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")

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
  const [check, setCheck] = useState<ImportCheck | null>(null)
  const [done, setDone] = useState<ImportDone | null>(null)
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
    let saved: Record<string, string> = {}
    try {
      saved = JSON.parse(localStorage.getItem(storeKey) ?? "{}") as Record<string, string>
    } catch {
      saved = {}
    }
    setMapping((current) => {
      const next: Record<string, number> = {}
      const used = new Set<number>()
      for (const t of targets.data!) {
        if (current[t.key] !== undefined && current[t.key] < headers.length) {
          next[t.key] = current[t.key]
          if (current[t.key] >= 0) used.add(current[t.key])
          continue
        }
        const fromSaved = headers.findIndex((h, i) => !used.has(i) && saved[h] === t.key)
        const byName = headers.findIndex((h, i) => !used.has(i) && [t.label, ...t.aliases].some((a) => norm(a) === norm(h)))
        const col = fromSaved >= 0 ? fromSaved : byName
        next[t.key] = col
        if (col >= 0) used.add(col)
      }
      return next
    })
    // Runs when the step, the headings or the field list change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, targets.data, storeKey])

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
      setMapping({})
    } catch (e) {
      setFileError(e instanceof Error ? e.message : String(e))
      setSheets([])
    }
  }

  const missing = (targets.data ?? []).filter((t) => t.required && (mapping[t.key] ?? -1) < 0)
  const mappedCols = new Set(Object.values(mapping).filter((c) => c >= 0))
  const unmapped = headers.map((h, i) => ({ h, i })).filter(({ i }) => !mappedCols.has(i) && data.some((r) => r.cells[i] !== ""))

  const payload = () => ({
    fileName,
    mapping: Object.fromEntries(Object.entries(mapping).filter(([, c]) => c >= 0).map(([k, c]) => [headers[c], k])),
    rows: data.map((r) => ({ row: r.row, values: Object.fromEntries(Object.entries(mapping).filter(([, c]) => c >= 0).map(([k, c]) => [k, r.cells[c] ?? ""])) })),
  })

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
    }
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
              Pick the column each field comes from. Fields marked <span className="font-semibold text-foreground">*</span> are needed. Columns left unmapped are not imported.
            </p>
            {targets.error && <p className="text-destructive">{targets.error}</p>}
            <MappingTable targets={targets.data ?? []} headers={headers} sample={data.slice(0, 3).map((r) => r.cells)} mapping={mapping} onChange={(k, c) => setMapping((m) => ({ ...m, [k]: c }))} />
            {unmapped.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                <span className="text-sm font-medium">Columns not mapped ({unmapped.length})</span>
                <span className="text-xs text-muted-foreground">
                  These columns will be left out.{can("settings.edit") ? ` Map them above, or add one as a new ${kind === "brands" ? "brand" : "product"} field (it then appears in Settings → Fields and on every ${kind === "brands" ? "brand" : "product"}).` : " Someone who can change Settings can add them as new fields."}
                </span>
                <ul className="flex flex-col divide-y rounded-md border bg-card">
                  {unmapped.map(({ h, i }) => (
                    <NewFieldRow
                      key={`${h}${i}`}
                      header={h}
                      sample={data.find((r) => r.cells[i] !== "")?.cells[i] ?? ""}
                      canAdd={can("settings.edit")}
                      entityType={kind === "brands" ? "brand" : "product"}
                      onAdded={async (key) => {
                        await targets.reload()
                        setMapping((m) => ({ ...m, [`custom.${key}`]: i }))
                      }}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === "check" && check && <CheckResults check={check} what={what} onDownload={() => rejectedCsv(check.rows)} />}

        {step === "done" && done && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CircleCheck className="size-8 text-[#17b26a]" />
            <p className="text-base font-semibold">
              {plural(done.imported, kind === "brands" ? "brand" : "product")} imported{done.newOrganisations ? `, with ${plural(done.newOrganisations, "new organisation")}` : ""}.
              {done.leadsOpened ? ` ${plural(done.leadsOpened, "lead")} opened at Register.` : ""}
            </p>
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

/** One row per field: which column it comes from, and what the first rows hold there. */
function MappingTable({ targets, headers, sample, mapping, onChange }: { targets: ImportTarget[]; headers: string[]; sample: string[][]; mapping: Record<string, number>; onChange: (key: string, col: number) => void }) {
  const groups = [...new Set(targets.map((t) => t.group))]
  const cols = "minmax(0,1.1fr) minmax(0,1fr) minmax(0,1.2fr)"
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: cols }}>
        <span>Field in ATM</span>
        <span>Column in your file</span>
        <span>First values</span>
      </div>
      {groups.map((g) => (
        <div key={g}>
          <div className="border-b bg-muted/20 px-3 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g}</div>
          <ul className="divide-y">
            {targets
              .filter((t) => t.group === g)
              .map((t) => {
                const col = mapping[t.key] ?? -1
                return (
                  <li key={t.key} className="grid items-center gap-3 px-3 py-2" style={{ gridTemplateColumns: cols }}>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">
                        {t.label}
                        {t.required && <span className="text-destructive"> *</span>}
                      </span>
                      {t.hint && <span className="text-xs text-muted-foreground">{t.hint}</span>}
                    </span>
                    <Select value={col >= 0 ? String(col) : NONE} onValueChange={(v) => onChange(t.key, v === NONE ? -1 : Number(v))}>
                      <SelectTrigger size="sm" className={cn("w-full bg-card", col < 0 && "text-muted-foreground", t.required && col < 0 && "border-destructive/50")} aria-label={`Column for ${t.label}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— Not mapped —</SelectItem>
                        {headers.map((h, i) => (
                          <SelectItem key={`${h}${i}`} value={String(i)}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="truncate text-xs text-muted-foreground">{col >= 0 ? sample.map((r) => r[col]).filter(Boolean).join(" · ") || "(empty)" : ""}</span>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** A column with no field: add it as a new field, then it maps itself. */
function NewFieldRow({ header, sample, canAdd, entityType, onAdded }: { header: string; sample: string; canAdd: boolean; entityType: "brand" | "product"; onAdded: (key: string) => Promise<void> }) {
  const [type, setType] = useState<FieldType>(/^-?[\d,.]+$/.test(sample) ? "number" : /^\d{4}-\d{2}-\d{2}$/.test(sample) ? "date" : sample.length > 120 ? "long_text" : "text")
  const [busy, run] = useBusy()
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{header}</span>
        {sample && <span className="truncate text-xs text-muted-foreground">e.g. {sample}</span>}
      </span>
      {canAdd && (
        <>
          <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
            <SelectTrigger size="sm" className="w-36 bg-card" aria-label={`Type for ${header}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              const f = await run(() => attempt(() => api.post<{ key: string }>("/records/fields", { entityType, label: header, type }), `${header} added as a ${entityType} field.`))
              if (f) await onAdded(f.key)
            }}
          >
            <Plus /> Add as field
          </Button>
        </>
      )}
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
        <Stat label={`Ready to import`} value={check.ready} tone="good" hint={check.newOrganisations ? `${plural(check.newOrganisations, "new organisation")}` : undefined} />
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
                {r.ok && <span className="font-medium">{r.summary}</span>}
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
