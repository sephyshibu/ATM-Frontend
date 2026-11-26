import { Pencil, Plus } from "lucide-react"
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
import type { GateDefinition } from "@/lib/types"

import { attempt, Group, LoadError, Loading, SectionCard, useBusy } from "./shared"

// Gates: the checks on every lead. Desk gates decide Target; call gates are confirmed after the call. More gates can
// be added (numbered after the last one), and any gate can be renamed, described and switched off for everyone
// (with a reason), never deleted; per brand, a gate is unticked on the brand's page instead. The recommendation
// rules are fixed and shown here.

const RULES: Record<string, string> = {
  category: "Checked against the brand's category.",
  revenue_band: "Checked against the brand's home revenue and the band in Configuration → Gates.",
  lane: "Checked against the brand's lane.",
}

export function GatesSection() {
  const { can } = useSession()
  const gates = useApi<GateDefinition[]>("/gates")
  const [editing, setEditing] = useState<GateDefinition | null>(null)
  const [adding, setAdding] = useState(false)
  const canEdit = can("settings.edit")
  const list = gates.data ?? []

  return (
    <SectionCard
      value="gates"
      title="Gates"
      description="The checks every lead goes through. Gates guide and never block: a decision against them is an override with a reason."
      canEdit={canEdit}
      lock={false}
      action={
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus /> Add a gate
        </Button>
      }
    >
      {gates.error ? (
        <LoadError message={gates.error} retry={gates.reload} />
      ) : !gates.data ? (
        <Loading />
      ) : (
        (["desk", "call"] as const).map((stage) => (
          <Group key={stage} title={stage === "desk" ? "Desk gates: decide Target" : "Call gates: confirmed after the qualifying call"} hint={stage === "desk" ? "Any fail → Not now · else any unknown → Review · all pass → Pursue" : "Any fail → Not now · else any unknown → Verification pending · all pass → SQL"}>
            <ul className="divide-y overflow-hidden rounded-lg border">
              {list
                .filter((g) => g.stage === stage)
                .map((g) => (
                  <li key={g.code} className={`flex items-start gap-3 px-4 py-2.5 ${g.active ? "" : "opacity-60"}`}>
                    <span className="w-8 shrink-0 font-mono text-sm text-muted-foreground">{g.code}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{g.name}</span>
                      <span className="text-xs text-muted-foreground">{g.checks}</span>
                      {g.rule && <span className="text-xs text-muted-foreground">{RULES[g.rule]}</span>}
                    </span>
                    {g.active ? <Chip tone={TONES.GREEN}>In use</Chip> : <Chip tone={TONES.MUTED}>Switched off</Chip>}
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(g)}>
                        <Pencil /> Edit
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </Group>
        ))
      )}
      {adding && (
        <GateAdd
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            void gates.reload()
          }}
        />
      )}
      {editing && (
        <GateEdit
          gate={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void gates.reload()
          }}
        />
      )}
    </SectionCard>
  )
}

function GateEdit({ gate, onClose, onSaved }: { gate: GateDefinition; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(gate.name)
  const [checks, setChecks] = useState(gate.checks)
  const [active, setActive] = useState(gate.active)
  const [reason, setReason] = useState("")
  const [busy, run] = useBusy()
  const switching = active !== gate.active
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-[480px]">
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <DialogTitle>Gate {gate.code}</DialogTitle>
          <DialogDescription>Changes apply to every lead from now on. Values already set on leads are kept.</DialogDescription>
        </div>
        <div className="flex flex-col gap-3 px-6 py-5">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-foreground" />
          </Field>
          <Field label="What it checks">
            <Textarea value={checks} onChange={(e) => setChecks(e.target.value)} className="min-h-16 text-foreground" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={active} onCheckedChange={setActive} aria-label="In use" />
            In use for every lead
          </label>
          {switching && (
            <Field label={`Why switch it ${active ? "on" : "off"}?`}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-14 text-foreground" />
            </Field>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !name.trim() || (switching && !reason.trim())}
            onClick={async () => {
              if (await run(() => attempt(() => api.patch(`/gates/${gate.code}`, { name, checks, active, reason }), "Gate saved."))) onSaved()
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A new gate: numbered after the last one, checked by hand or from the Brand Register. */
export function GateAdd({ initialName = "", onClose, onSaved }: { initialName?: string; onClose: () => void; onSaved: (g: GateDefinition) => void }) {
  const [name, setName] = useState(initialName)
  const [checks, setChecks] = useState("")
  const [stage, setStage] = useState<"desk" | "call">("desk")
  const [busy, run] = useBusy()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-[480px]">
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <DialogTitle>Add a gate</DialogTitle>
          <DialogDescription>It's added to every lead at once and counts in its stage's recommendation. Until someone checks it, it shows as not checked, so recommendations may move to Review.</DialogDescription>
        </div>
        <div className="flex flex-col gap-3 px-6 py-5">
          <Field label="Name">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. No in-house Asia team" className="h-8 text-foreground" />
          </Field>
          <Field label="What it checks">
            <Textarea value={checks} onChange={(e) => setChecks(e.target.value)} placeholder="e.g. The brand has no Asia capability of its own and 15–80 staff." className="min-h-16 text-foreground" />
          </Field>
          <Field label="When it's checked">
            <Select value={stage} onValueChange={(v) => setStage(v as "desk" | "call")}>
              <SelectTrigger size="sm" className="w-full bg-card text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desk">At the desk: decides Target</SelectItem>
                <SelectItem value="call">On the call: confirmed after the qualifying call</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || name.trim().length < 2}
            onClick={async () => {
              const g = await run(() => attempt(() => api.post<GateDefinition>("/gates", { name: name.trim(), checks: checks.trim(), stage }), (g) => `Gate ${g.code} ${g.name} added.`))
              if (g) onSaved(g)
            }}
          >
            Add gate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
