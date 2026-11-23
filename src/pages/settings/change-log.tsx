import { format } from "date-fns"
import { Download, Loader2, Search, X } from "lucide-react"
import { useEffect, useState } from "react"

import { showToast } from "@/components/common/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, useApi } from "@/lib/api"
import { dateTimeLabel, plural } from "@/lib/format"
import type { AuditEntry, AuditPage } from "@/lib/types"
import { cn } from "@/lib/utils"

import { LoadError, Loading, SectionCard } from "./shared"

// The change log: every change made in Settings and every sign-in, with who, when, the value before and after,
// and why. Append-only: the database refuses to edit or remove an entry, for everyone.

/** The entries shown, as a CSV file that opens in Excel and Sheets. */
function exportCsv(rows: AuditEntry[]) {
  const cell = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`
  const head = ["Date and time", "Who", "Section", "Change", "Before", "After", "Why"]
  const lines = rows.map((e) => [format(new Date(e.at), "yyyy-MM-dd HH:mm"), e.actorLabel, e.section, e.action, e.before, e.after, e.reason].map(cell).join(","))
  // The byte-order mark makes Excel read the file as UTF-8.
  const blob = new Blob(["﻿" + [head.map(cell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `ATM change log ${format(new Date(), "yyyy-MM-dd")}.csv`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const ROW = "grid grid-cols-[130px_150px_130px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4"
const ANY = "any"

export function ChangeLogSection() {
  const sections = useApi<string[]>("/audit/sections")
  const [section, setSection] = useState(ANY)
  const [days, setDays] = useState(ANY)
  const [typed, setTyped] = useState("")
  const [search, setSearch] = useState("")
  const [rows, setRows] = useState<AuditEntry[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "more" | { error: string }>("loading")

  // Search after a short pause in typing.
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(typed.trim()), 300)
    return () => window.clearTimeout(t)
  }, [typed])

  const query = (before?: string) => {
    const q = new URLSearchParams({ limit: "100" })
    if (section !== ANY) q.set("section", section)
    if (days !== ANY) q.set("days", days)
    if (search) q.set("search", search)
    if (before) q.set("before", before)
    return `/audit?${q}`
  }

  const load = async (more = false) => {
    setState(more ? "more" : "loading")
    try {
      const page = await api.get<AuditPage>(query(more ? (next ?? undefined) : undefined))
      setRows((cur) => (more ? [...cur, ...page.entries] : page.entries))
      setNext(page.next)
      setState("ready")
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) })
    }
  }

  useEffect(() => {
    void load()
    // Reload from the top whenever a filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, days, search])

  return (
    <SectionCard value="log" title="Change log" description="Every change in Settings and every sign-in: who, when, the value before and after, and why. Nobody can edit it." canEdit>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search the log" aria-label="Search the log" className="h-8 pr-8 pl-8" />
          {typed && (
            <button type="button" aria-label="Clear search" onClick={() => setTyped("")} className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Select value={section} onValueChange={setSection}>
          <SelectTrigger size="sm" className="w-44 bg-card" aria-label="Section">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Every section</SelectItem>
            {(sections.data ?? []).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger size="sm" className="w-40 bg-card" aria-label="When">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any time</SelectItem>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto bg-card"
          disabled={!rows.length}
          title={next ? `Exports the ${rows.length} entries loaded so far` : "Exports every entry shown"}
          onClick={() => {
            exportCsv(rows)
            showToast(`Exported ${plural(rows.length, "entry", "entries")}.`)
          }}
        >
          <Download />
          Export
        </Button>
      </div>

      {typeof state === "object" ? (
        <LoadError message={state.error} retry={() => load()} />
      ) : state === "loading" ? (
        <Loading />
      ) : !rows.length ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">Nothing matches. Try another search or clear the filters.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <div className={cn(ROW, "border-b bg-muted/40 py-2 text-xs font-medium text-muted-foreground")}>
              <span>When</span>
              <span>Who</span>
              <span>Section</span>
              <span>Change</span>
              <span>Before</span>
              <span>After</span>
            </div>
            <ul className="divide-y">
              {rows.map((e) => (
                <li key={e.id} className={cn(ROW, "items-start py-2.5")}>
                  <span className="text-xs whitespace-nowrap text-muted-foreground" title={format(new Date(e.at), "yyyy-MM-dd HH:mm:ss")}>
                    {dateTimeLabel(e.at)}
                  </span>
                  <span className="truncate font-medium" title={e.actorLabel}>
                    {e.actorLabel.replace(/\s*<[^>]*>$/, "")}
                  </span>
                  <span className="text-muted-foreground">{e.section}</span>
                  <span className="min-w-0">
                    {e.action}
                    {e.reason && <span className="block text-xs text-muted-foreground">Why: {e.reason}</span>}
                  </span>
                  <span className="min-w-0 text-xs whitespace-pre-wrap text-muted-foreground">{e.before || "—"}</span>
                  <span className="min-w-0 text-xs whitespace-pre-wrap">{e.after || "—"}</span>
                </li>
              ))}
            </ul>
          </div>
          {next && (
            <Button variant="outline" size="sm" className="self-center bg-card" disabled={state === "more"} onClick={() => load(true)}>
              {state === "more" && <Loader2 className="animate-spin" />}
              Load older entries
            </Button>
          )}
        </>
      )}
    </SectionCard>
  )
}
