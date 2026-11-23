import { CircleAlert, FlaskConical, Play, Shuffle, Undo2 } from "lucide-react"
import { useState } from "react"

import { MoreMenu } from "@/components/common/more-menu"
import { NotePanel } from "@/components/common/panels"
import { SearchPick } from "@/components/common/search-pick"
import { Button } from "@/components/ui/button"
import { api, useApi } from "@/lib/api"
import { dateLabel, dateTimeLabel } from "@/lib/format"
import { personName } from "@/lib/records"
import { useSession } from "@/lib/session"
import type { AvailableMove, BrandDetail, Journey, LeadDetail, RecordOptions } from "@/lib/types"
import { cn } from "@/lib/utils"

import { Card } from "../records/shared"
import { attempt } from "../settings/shared"
import { FlagChips, MoveDialog, OverrideDialog, StageChip } from "./shared"

// The brand's journey on its page: where the lead is, the moves you can make now, undo, and every move so far.
// Earlier journeys of the brand (closed leads) are listed under it.

export function LeadCard({ brand, options }: { brand: BrandDetail; options?: RecordOptions }) {
  const { can } = useSession()
  const leads = useApi<LeadDetail[]>(`/leads/brand/${brand.id}`)
  const journey = useApi<Journey>("/leads/journey")
  const [opening, setOpening] = useState(false)
  const list = leads.data ?? []
  const current = list.find((l) => !l.closed) ?? list[0]
  const earlier = list.filter((l) => l !== current)

  const open = async () => {
    setOpening(true)
    try {
      if (await attempt(() => api.post(`/leads/brand/${brand.id}`, {}), "Lead opened at Register.")) void leads.reload()
    } finally {
      setOpening(false)
    }
  }

  const canOpen = can("records.edit") && !brand.archived && !brand.organisation.excluded && !list.some((l) => !l.closed)

  return (
    <Card
      title="Lead"
      action={
        canOpen && (
          <Button size="sm" variant="outline" disabled={opening} onClick={open}>
            <Play /> {list.length ? "Open a new lead" : "Open a lead"}
          </Button>
        )
      }
    >
      {leads.error ? (
        <p className="text-destructive">{leads.error}</p>
      ) : !leads.data ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !current ? (
        <p className="text-muted-foreground">No lead yet. {brand.organisation.excluded ? `${brand.organisation.name} is excluded, so no lead can be opened.` : "Open one to start the journey at Register."}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <LeadView lead={current} brand={brand} options={options} journey={journey.data} onChanged={() => void leads.reload()} />
          {earlier.length > 0 && (
            <details className="rounded-lg border px-3 py-2">
              <summary className="cursor-pointer text-sm text-muted-foreground">Earlier journeys ({earlier.length})</summary>
              <div className="mt-3 flex flex-col gap-4">
                {earlier.map((l) => (
                  <LeadView key={l.id} lead={l} brand={brand} options={options} journey={journey.data} onChanged={() => void leads.reload()} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </Card>
  )
}

function LeadView({ lead, brand, options, journey, onChanged }: { lead: LeadDetail; brand: BrandDetail; options?: RecordOptions; journey?: Journey; onChanged: () => void }) {
  const { can } = useSession()
  const [moving, setMoving] = useState<AvailableMove | null>(null)
  const [overriding, setOverriding] = useState(false)
  const moves = lead.available.filter((m) => m.allowed)
  const people = brand.people.map((p) => ({ value: p.id, label: personName(p), hint: p.jobTitle || undefined }))

  const confirmMove = async (m: AvailableMove, input: { reasonCode?: string; reason?: string; until?: string }) => {
    const r = await attempt(() => api.post(`/leads/${lead.id}/move`, { moveKey: m.key, ...input }), `${brand.name}: ${m.to}.`)
    if (r) {
      setMoving(null)
      onChanged()
    }
    return !!r
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StageChip lead={lead} />
          <span className="text-xs text-muted-foreground">
            since {dateLabel(lead.stageChangedAt)}
            {lead.laneUntil && ` · until ${dateLabel(lead.laneUntil)}`} · {lead.source}
          </span>
          <FlagChips labels={lead.flagLabels} />
        </div>
        <div className="flex items-center gap-1.5">
          {lead.canUndo && (
            <MoreMenu
              label="Undo"
              actions={[
                {
                  label: lead.undoLabel ? `Undo: ${lead.undoLabel}` : "Undo the last move",
                  icon: Undo2,
                  panel: (close) => (
                    <NotePanel
                      title={lead.undoLabel ? `Undo: ${lead.undoLabel}?` : "Undo the last move?"}
                      placeholder="Why (required)"
                      confirm="Undo"
                      required
                      close={close}
                      onConfirm={async (reason) => {
                        if (await attempt(() => api.post(`/leads/${lead.id}/undo`, { reason }), "Undone.")) onChanged()
                      }}
                    />
                  ),
                },
              ]}
            />
          )}
          {can("control.override") && (
            <MoreMenu
              label="Override and test events"
              actions={[
                { label: "Override the stage…", icon: Shuffle, onSelect: () => setOverriding(true) },
                ...lead.events.map((e, i) => ({
                  label: `Test event: ${e.label} → ${e.to}`,
                  icon: FlaskConical,
                  separator: i === 0,
                  onSelect: async () => {
                    if (await attempt(() => api.post(`/leads/${lead.id}/event`, { type: e.type, note: "Recorded by hand for testing" }), `${e.label} recorded.`)) onChanged()
                  },
                })),
              ]}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Main contact</span>
        <div className="w-64">
          <SearchPick
            options={people}
            value={lead.personId ?? ""}
            disabled={!can("records.edit") || lead.closed}
            placeholder="None"
            aria-label="Main contact"
            onChange={async (personId) => {
              if (await attempt(() => api.patch(`/leads/${lead.id}/person`, { personId: personId || null }), "Main contact changed.")) onChanged()
            }}
          />
        </div>
      </div>

      {!lead.closed && moves.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {moves.map((m) => (
              <Button key={m.key} size="sm" variant={m.ends ? "outline" : m.key === "to_target" || m.key.startsWith("mark_") || m.key === "vp_sql" || m.key === "reply_interested" ? "default" : "outline"} className={cn(m.ends && "text-destructive")} disabled={m.blockers.length > 0} title={m.help} onClick={() => setMoving(m)}>
                {m.label}
              </Button>
            ))}
          </div>
          {moves
            .filter((m) => m.blockers.length)
            .map((m) => (
              <div key={m.key} className="flex flex-col gap-1 rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-xs text-[#93370d]">
                <span className="font-medium">Not ready for {m.to}:</span>
                {m.blockers.map((b) => (
                  <span key={b} className="flex items-start gap-1.5">
                    <CircleAlert className="mt-0.5 size-3 shrink-0" />
                    {b}
                  </span>
                ))}
              </div>
            ))}
        </div>
      )}
      {!lead.closed && !moves.length && <p className="text-xs text-muted-foreground">No moves for you here. {lead.available.length ? "Your roles don't allow the moves at this stage." : "The next move comes from a buyer event (email delivered, reply, booking)."}</p>}

      <ol className="flex flex-col border-t pt-3">
        {lead.moves.map((m) => (
          <li key={m.id} className={cn("relative border-l pb-3 pl-4 last:pb-0", m.undoneAt && "opacity-60")}>
            <span className={cn("absolute top-1.5 -left-[4.5px] size-2 rounded-full", m.kind === "system" ? "bg-primary" : m.kind === "override" ? "bg-[#f79009]" : "bg-border")} />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className={cn("font-medium", m.undoneAt && "line-through")}>{m.label}</span>
              <span className="text-xs text-muted-foreground">
                {m.from ? `${m.from} → ` : ""}
                {m.to}
                {m.toUntil ? ` (until ${dateLabel(m.toUntil)})` : ""}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {m.actorLabel.replace(/\s*<[^>]*>$/, "")} · {dateTimeLabel(m.at)}
              {m.undoneAt && ` · undone ${dateTimeLabel(m.undoneAt)}`}
            </span>
            {(m.reasonCode || m.reason) && <p className="text-xs">{[m.reasonCode, m.reason].filter(Boolean).join(": ")}</p>}
          </li>
        ))}
      </ol>

      {moving && (
        <MoveDialog
          open
          title={moving.label}
          help={moving.help}
          to={moving.to}
          ends={moving.ends}
          reasonList={moving.reasonList}
          reasonRequired={moving.reasonRequired}
          untilRequired={moving.untilRequired}
          warnings={moving.warnings}
          options={options}
          onClose={() => setMoving(null)}
          onConfirm={(input) => confirmMove(moving, input)}
        />
      )}
      <OverrideDialog
        open={overriding}
        journey={journey}
        onClose={() => setOverriding(false)}
        onConfirm={async (v) => {
          const r = await attempt(() => api.post(`/leads/${lead.id}/override`, v), "Overridden.")
          if (r) {
            setOverriding(false)
            onChanged()
          }
          return !!r
        }}
      />
    </div>
  )
}
