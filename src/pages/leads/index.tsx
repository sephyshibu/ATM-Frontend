import { CircleAlert, Play } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, Navigate, useSearchParams } from "react-router-dom"

import { ListToolbar, NoMatches, useListControls } from "@/components/common/list-toolbar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { api, useApi } from "@/lib/api"
import { dateLabel, plural } from "@/lib/format"
import { personName, useRecordOptions } from "@/lib/records"
import { useSession } from "@/lib/session"
import type { Journey, LeadRow } from "@/lib/types"
import { cn } from "@/lib/utils"

import { EmptyList } from "../records/shared"
import { attempt, LoadError, Loading } from "../settings/shared"
import { FlagChips, MoveDialog, StageChip } from "./shared"

// Leads: every journey, by stage. Register is the Target checkpoint: tick brands and move them to Target, park
// them or mark them not pursued, many at once. Each lead's own moves, undo and history are on its brand's page.

type BulkMove = { key: string; label: string; help: string; to: string; untilRequired?: boolean; reasonList?: string; ends?: boolean }

const BULK: Record<string, BulkMove[]> = {
  register: [
    { key: "to_target", label: "Move to Target", help: "Ready for the next weekly batch.", to: "Target" },
    { key: "park", label: "Park", help: "Not now; look again on the recheck date.", to: "Parked", untilRequired: true },
    { key: "not_pursued", label: "Not pursued", help: "Ends these journeys, with a reason.", to: "Not pursued", reasonList: "disqualify_reason", ends: true },
  ],
  target: [{ key: "back_to_register", label: "Back to Register", help: "Take them out of Target before they are sent.", to: "Register" }],
  parked: [{ key: "unpark", label: "Back to Register", help: "Look at them again now.", to: "Register" }],
}

export function LeadsPage() {
  const { can } = useSession()
  const [params, setParams] = useSearchParams()
  const leads = useApi<LeadRow[]>("/leads")
  const journey = useApi<Journey>("/leads/journey")
  const options = useRecordOptions()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState<BulkMove | null>(null)
  const [refused, setRefused] = useState<{ name: string; message: string }[]>([])
  const [opening, setOpening] = useState(false)

  const all = useMemo(() => leads.data ?? [], [leads.data])
  const tabs = useMemo(() => {
    const stages = (journey.data?.stages ?? []).map((s) => ({ key: s.key, label: s.label, rows: all.filter((l) => l.stage === s.key && !l.lane) }))
    const lanes = all.filter((l) => l.lane && !l.closed)
    const closed = all.filter((l) => l.closed && l.stage !== "sql")
    return [...stages, { key: "lanes", label: "Side lanes", rows: lanes }, { key: "closed", label: "Closed", rows: closed }, { key: "all", label: "All", rows: all }]
  }, [all, journey.data])
  const tab = tabs.find((t) => t.key === params.get("stage")) ?? tabs[0]
  const rows = tab?.rows ?? []

  const { shown, toolbar } = useListControls(rows, {
    placeholder: "Search brands, organisations, contacts",
    search: (l) => `${l.brand.name} ${l.brand.domain} ${l.brand.organisation.name} ${l.person ? personName(l.person) : ""}`,
    filters: [
      { id: "lane", label: "Side lane", options: [...new Set(rows.filter((l) => l.lane).map((l) => l.lane!))].map((k) => ({ value: k, label: journey.data?.lanes.find((x) => x.key === k)?.label ?? k })), test: (l, v) => l.lane === v },
      { id: "flag", label: "Flags", options: [...new Set(rows.flatMap((l) => l.flags))].map((f) => ({ value: f, label: journey.data?.flags[f] ?? f })), test: (l, v) => l.flags.includes(v) },
      { id: "source", label: "Source", options: [...new Set(rows.map((l) => l.source))].map((s) => ({ value: s, label: s })), test: (l, v) => l.source === v },
    ],
    sorts: [
      { value: "since", label: "Time at this stage", key: (l) => l.stageChangedAt },
      { value: "brand", label: "Brand", key: (l) => l.brand.name },
    ],
    defaultSort: "since",
  })

  if (!can("records.view")) return <Navigate to="/no-access" replace />

  const parkedOnly = shown.length > 0 && shown.every((l) => l.lane === "parked")
  const bulkMoves = can("leads.move_target") ? (tab?.key === "lanes" && parkedOnly ? BULK.parked : (BULK[tab?.key ?? ""] ?? [])) : []
  const visibleSelected = shown.filter((l) => selected.has(l.id))
  const allTicked = shown.length > 0 && visibleSelected.length === shown.length
  const cols = `${bulkMoves.length ? "28px " : ""}minmax(0,1.6fr) minmax(0,1.2fr) minmax(0,1.3fr) minmax(0,1.2fr) 110px minmax(0,1.6fr)`

  const pickTab = (key: string) => {
    setSelected(new Set())
    setRefused([])
    setParams({ stage: key }, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">Leads</h1>
          <p className="text-sm text-muted-foreground">Every brand's journey from Register to SQL. Open a brand to move its lead one by one, undo, or see its history.</p>
        </div>
        {can("records.edit") && (
          <Button
            size="sm"
            variant="outline"
            disabled={opening}
            title="For brands added before leads existed, or by hand"
            onClick={async () => {
              setOpening(true)
              try {
                const r = await attempt(() => api.post<{ opened: number }>("/leads/open-missing"), (x) => (x.opened ? `${plural(x.opened, "lead")} opened at Register.` : "Every brand already has a lead."))
                if (r?.opened) void leads.reload()
              } finally {
                setOpening(false)
              }
            }}
          >
            <Play /> Open leads for brands without one
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => pickTab(t.key)}
            className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm", t.key === tab?.key ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{t.rows.length}</span>
          </button>
        ))}
      </div>

      <ListToolbar toolbar={toolbar}>
        {visibleSelected.length > 0 &&
          bulkMoves.map((m) => (
            <Button key={m.key} size="sm" variant={m.ends ? "outline" : "default"} className={cn(m.ends && "text-destructive")} onClick={() => setBulk(m)}>
              {m.label} ({visibleSelected.length})
            </Button>
          ))}
      </ListToolbar>

      {refused.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <span className="font-medium">{plural(refused.length, "lead")} not moved:</span>
          {refused.map((r) => (
            <span key={r.name} className="flex items-start gap-1.5 text-xs">
              <CircleAlert className="mt-0.5 size-3 shrink-0 text-destructive" />
              <span>
                <span className="font-medium">{r.name}:</span> {r.message}
              </span>
            </span>
          ))}
        </div>
      )}

      {leads.error ? (
        <LoadError message={leads.error} retry={leads.reload} />
      ) : !leads.data || !journey.data ? (
        <Loading />
      ) : !rows.length ? (
        <EmptyList>{all.length ? `No leads at ${tab?.label}.` : "No leads yet. Importing brands opens their leads at Register; or open them from a brand's page."}</EmptyList>
      ) : !shown.length ? (
        <NoMatches />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: cols }}>
            {bulkMoves.length > 0 && <Checkbox checked={allTicked ? true : visibleSelected.length ? "indeterminate" : false} onCheckedChange={(v) => setSelected(v === true ? new Set(shown.map((l) => l.id)) : new Set())} aria-label="Tick all" />}
            <span>Brand</span>
            <span>Organisation</span>
            <span>Stage</span>
            <span>Main contact</span>
            <span>Since</span>
            <span>Last move</span>
          </div>
          <ul className="divide-y">
            {shown.map((l) => (
              <li key={l.id} className="grid items-center gap-3 px-4 py-2.5 hover:bg-muted/30" style={{ gridTemplateColumns: cols }}>
                {bulkMoves.length > 0 && (
                  <Checkbox
                    checked={selected.has(l.id)}
                    onCheckedChange={(v) =>
                      setSelected((s) => {
                        const n = new Set(s)
                        if (v === true) n.add(l.id)
                        else n.delete(l.id)
                        return n
                      })
                    }
                    aria-label={`Tick ${l.brand.name}`}
                  />
                )}
                <Link to={`/records/brands/${l.brand.id}`} className="flex min-w-0 flex-col hover:underline">
                  <span className="truncate font-medium">{l.brand.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{l.brand.domain}</span>
                </Link>
                <span className="truncate">{l.brand.organisation.name}</span>
                <span className="flex min-w-0 flex-col gap-1">
                  <StageChip lead={l} />
                  <FlagChips labels={l.flagLabels} />
                </span>
                <span className="truncate">{l.person ? personName(l.person) : <span className="text-muted-foreground">—</span>}</span>
                <span className="text-xs text-muted-foreground">
                  {dateLabel(l.stageChangedAt)}
                  {l.laneUntil && <span className="block">until {dateLabel(l.laneUntil)}</span>}
                </span>
                <span className="truncate text-xs text-muted-foreground">{l.lastMove ? `${l.lastMove.label} · ${l.lastMove.actorLabel.replace(/\s*<[^>]*>$/, "")}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bulk && (
        <MoveDialog
          open
          title={bulk.label}
          help={bulk.help}
          to={bulk.to}
          ends={bulk.ends}
          reasonList={bulk.reasonList}
          untilRequired={bulk.untilRequired}
          options={options.data}
          count={visibleSelected.length}
          onClose={() => setBulk(null)}
          onConfirm={async (input) => {
            const r = await attempt(
              () => api.post<{ moved: number; refused: number; results: { id: string; ok: boolean; message: string }[] }>("/leads/bulk-move", { leadIds: visibleSelected.map((l) => l.id), moveKey: bulk.key, ...input }),
              (x) => (x.refused ? `${plural(x.moved, "lead")} moved, ${x.refused} not moved.` : `${plural(x.moved, "lead")} moved to ${bulk.to}.`),
            )
            if (!r) return false
            setRefused(r.results.filter((x) => !x.ok).map((x) => ({ name: all.find((l) => l.id === x.id)?.brand.name ?? x.id, message: x.message })))
            setSelected(new Set())
            setBulk(null)
            void leads.reload()
            return true
          }}
        />
      )}
    </div>
  )
}
