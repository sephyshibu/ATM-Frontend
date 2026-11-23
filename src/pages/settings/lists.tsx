import { ArchiveRestore, Archive, Pencil, Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { Chip } from "@/components/common/chip"
import { MoreMenu } from "@/components/common/more-menu"
import { NotePanel } from "@/components/common/panels"
import { TONES } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import { plural } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { ListValue, PickList } from "@/lib/types"
import { cn } from "@/lib/utils"

import { attempt, LoadError, Loading, SectionCard, useBusy } from "./shared"

// Lists: the pick-lists people choose from (categories, sub-categories, lanes, reason codes). A value's code
// never changes; its name can. Values are retired, never deleted, so records that used them still read right.

const ROW = "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_110px_28px] items-center gap-3 px-4"

export function ListsSection() {
  const { can } = useSession()
  const [retired, setRetired] = useState(false)
  const lists = useApi<PickList[]>(`/settings/lists?retired=${retired}`)
  const [picked, setPicked] = useState<string>("")
  const canEdit = can("settings.edit")
  const all = lists.data ?? []
  const current = all.find((l) => l.key === picked) ?? all[0]
  const parent = current?.parentListKey ? all.find((l) => l.key === current.parentListKey) : undefined

  return (
    <SectionCard value="lists" title="Lists" description="The choices people pick from. Names can change; codes never do. Retired values stay on old records." canEdit={canEdit} lock={false}>
      {lists.error ? (
        <LoadError message={lists.error} retry={lists.reload} />
      ) : !current ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-5">
          <nav aria-label="Lists" className="flex flex-col gap-0.5">
            {all.map((l) => {
              const live = l.values.filter((v) => !v.retired).length
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setPicked(l.key)}
                  className={cn("flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-muted/60", l.key === current.key && "bg-primary/10 font-semibold text-primary hover:bg-primary/10")}
                >
                  <span className="truncate">{l.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{live}</span>
                </button>
              )
            })}
          </nav>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="font-semibold">{current.label}</h3>
                <p className="text-xs text-muted-foreground">{current.description}</p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={retired} onCheckedChange={setRetired} aria-label="Show retired values" />
                Show retired
              </label>
            </div>
            <ValuesTable list={current} parent={parent} canEdit={canEdit} onChanged={lists.reload} />
            {canEdit && <AddValue key={current.key} list={current} parent={parent} onAdded={lists.reload} />}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

function ValuesTable({ list, parent, canEdit, onChanged }: { list: PickList; parent?: PickList; canEdit: boolean; onChanged: () => void }) {
  // A child list (sub-categories) shows its values under each parent value (category).
  const sections = useMemo(() => {
    if (!parent) return [{ title: "", values: list.values }]
    return parent.values.map((p) => ({ title: p.label + (p.retired ? " (retired)" : ""), values: list.values.filter((v) => v.parentId === p.id) })).filter((s) => s.values.length)
  }, [list, parent])

  if (!list.values.length) return <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">Nothing in this list yet.</p>
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className={cn(ROW, "border-b bg-muted/40 py-2 text-xs font-medium text-muted-foreground")}>
        <span>Name</span>
        <span>Code</span>
        <span>Status</span>
        <span />
      </div>
      {sections.map((s) => (
        <div key={s.title || "all"}>
          {s.title && <div className="border-b bg-muted/20 px-4 py-1.5 text-xs font-semibold text-muted-foreground">{s.title}</div>}
          <ul className="divide-y border-b last:border-b-0">
            {s.values.map((v) => (
              <ValueRow key={v.id} value={v} listLabel={list.label} canEdit={canEdit} onChanged={onChanged} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function ValueRow({ value: v, listLabel, canEdit, onChanged }: { value: ListValue; listLabel: string; canEdit: boolean; onChanged: () => void }) {
  return (
    <li className={cn(ROW, "py-2", v.retired && "opacity-60")}>
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{v.label}</span>
        {v.description && <span className="truncate text-xs text-muted-foreground">{v.description}</span>}
      </span>
      <span className="truncate font-mono text-xs text-muted-foreground">{v.code}</span>
      <span>{v.retired ? <Chip tone={TONES.MUTED}>Retired</Chip> : <Chip tone={TONES.GREEN}>In use</Chip>}</span>
      {canEdit ? (
        <MoreMenu
          label={`More options for ${v.label}`}
          actions={[
            !v.retired && { label: "Rename", icon: Pencil, panel: (close) => <RenamePanel value={v} close={close} onDone={onChanged} /> },
            v.retired
              ? {
                  label: "Restore",
                  icon: ArchiveRestore,
                  onSelect: async () => {
                    if (await attempt(() => api.post(`/settings/list-values/${v.id}/restore`), `${v.label} is back in ${listLabel}.`)) onChanged()
                  },
                }
              : {
                  label: "Retire",
                  icon: Archive,
                  destructive: true,
                  separator: true,
                  panel: (close) => (
                    <NotePanel
                      title={`Retire ${v.label}?`}
                      placeholder="Why (optional). Records that use it keep showing it."
                      confirm="Retire"
                      destructive
                      close={close}
                      onConfirm={async (reason) => {
                        if (await attempt(() => api.post(`/settings/list-values/${v.id}/retire`, { reason }), `${v.label} retired. It can't be picked any more.`)) onChanged()
                      }}
                    />
                  ),
                },
          ]}
        />
      ) : (
        <span />
      )}
    </li>
  )
}

function RenamePanel({ value, close, onDone }: { value: ListValue; close: () => void; onDone: () => void }) {
  const [label, setLabel] = useState(value.label)
  const [description, setDescription] = useState(value.description)
  const [busy, run] = useBusy()
  return (
    <>
      <p className="font-medium">Rename {value.label}</p>
      <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Name" className="h-8" />
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" aria-label="Description" className="min-h-14" />
      <p className="text-xs text-muted-foreground">The code {value.code} stays the same.</p>
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={close}>
          Back
        </Button>
        <Button
          size="sm"
          disabled={!label.trim() || busy}
          onClick={async () => {
            const r = await run(() => attempt(() => api.patch(`/settings/list-values/${value.id}`, { label: label.trim(), description: description.trim() }), "Saved."))
            if (r) {
              onDone()
              close()
            }
          }}
        >
          Save
        </Button>
      </div>
    </>
  )
}

function AddValue({ list, parent, onAdded }: { list: PickList; parent?: PickList; onAdded: () => void }) {
  const [label, setLabel] = useState("")
  const [parentId, setParentId] = useState("")
  const [busy, run] = useBusy()
  const parents = parent?.values.filter((v) => !v.retired) ?? []
  const ok = !!label.trim() && (!parent || !!parentId)
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ok) return
        const r = await run(() => attempt(() => api.post(`/settings/lists/${list.key}/values`, { label: label.trim(), ...(parent ? { parentId } : {}) }), `${label.trim()} added to ${list.label}.`))
        if (r) {
          setLabel("")
          onAdded()
        }
      }}
    >
      {parent && (
        <Select value={parentId} onValueChange={setParentId}>
          <SelectTrigger size="sm" className="w-56 bg-card" aria-label={`Under which ${parent.label.toLowerCase()}`}>
            <SelectValue placeholder={`Under which ${parent.label.toLowerCase().replace(/ies$/, "y").replace(/s$/, "")}…`} />
          </SelectTrigger>
          <SelectContent>
            {parents.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`Add to ${list.label.toLowerCase()}`} aria-label={`New value for ${list.label}`} className="h-8 max-w-xs" />
      <Button type="submit" size="sm" variant="outline" className="bg-card" disabled={!ok || busy}>
        <Plus />
        Add
      </Button>
      <span className="ml-auto text-xs text-muted-foreground">{plural(list.values.filter((v) => !v.retired).length, "value")} in use</span>
    </form>
  )
}
