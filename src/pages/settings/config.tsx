import { History, Pencil } from "lucide-react"
import { useMemo, useState } from "react"

import { Field } from "@/components/common/form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import { dateTimeLabel, monthDayLabel, numberLabel } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { ConfigHistory, ConfigItem } from "@/lib/types"

import { attempt, Group, LoadError, Loading, SectionCard, useBusy } from "./shared"

// Configuration: the clocks, booking emails, side lanes, quiet period, weekly batch and gate values the CRM runs
// on. Each change is a new version with who, when and why; the earlier values stay in the history.

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

function display(c: ConfigItem) {
  if (c.value === null) return "Not set"
  if (c.type === "month_day") return monthDayLabel(String(c.value))
  if (c.type === "boolean") return c.value ? "On" : "Off"
  if (c.unit === "weekday") return WEEKDAYS[Number(c.value) - 1] ?? String(c.value)
  if (c.type === "integer") return c.unit === "USD" ? `USD ${numberLabel(Number(c.value))}` : `${numberLabel(Number(c.value))} ${c.unit}`
  return String(c.value)
}

export function ConfigSection() {
  const { can } = useSession()
  const config = useApi<ConfigItem[]>("/settings/config")
  const [history, setHistory] = useState<ConfigItem | null>(null)
  const canEdit = can("settings.edit")

  const groups = useMemo(() => {
    const out = new Map<string, ConfigItem[]>()
    for (const c of config.data ?? []) out.set(c.group, [...(out.get(c.group) ?? []), c])
    return [...out.entries()]
  }, [config.data])

  const replace = (c: ConfigItem) => config.setData((cur) => cur?.map((x) => (x.key === c.key ? c : x)))

  return (
    <SectionCard value="config" title="Configuration" description="The clocks, dates and limits the CRM runs on. Every change is kept as a new version." canEdit={canEdit} lock={false}>
      {config.error ? (
        <LoadError message={config.error} retry={config.reload} />
      ) : config.loading && !config.data ? (
        <Loading />
      ) : (
        groups.map(([group, items]) => (
          <Group key={group} title={group}>
            <ul className="divide-y rounded-lg border">
              {items.map((c) => (
                <li key={c.key} className="grid grid-cols-[minmax(0,1fr)_200px_auto] items-center gap-4 px-4 py-2.5">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{c.label}</span>
                    <span className="text-xs text-muted-foreground">{c.description}</span>
                  </span>
                  <span className="flex flex-col">
                    <span className="font-medium tabular-nums">{display(c)}</span>
                    {c.changedBy && c.changedAt && <span className="truncate text-[11px] text-muted-foreground">{`${c.changedBy} · ${dateTimeLabel(c.changedAt)}`}</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    {canEdit && <EditValue item={c} onSaved={replace} />}
                    <Button variant="ghost" size="icon-xs" aria-label={`History of ${c.label}`} title="History" onClick={() => setHistory(c)}>
                      <History />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </Group>
        ))
      )}
      <HistoryDialog item={history} onClose={() => setHistory(null)} />
    </SectionCard>
  )
}

function EditValue({ item, onSaved }: { item: ConfigItem; onSaved: (c: ConfigItem) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`Change ${item.label}`} title="Change">
          <Pencil />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-2.5 p-3">
        {open && <EditForm item={item} close={() => setOpen(false)} onSaved={onSaved} />}
      </PopoverContent>
    </Popover>
  )
}

function EditForm({ item, close, onSaved }: { item: ConfigItem; close: () => void; onSaved: (c: ConfigItem) => void }) {
  const [value, setValue] = useState<string | boolean>(item.type === "boolean" ? !!item.value : String(item.value ?? ""))
  const [reason, setReason] = useState("")
  const [busy, run] = useBusy()
  const n = Number(value)
  const invalid =
    item.type === "integer"
      ? value === "" || !Number.isInteger(n) || (item.min !== null && n < item.min) || (item.max !== null && n > item.max)
      : item.type === "month_day"
        ? !/^\d{2}-\d{2}$/.test(String(value))
        : item.type === "time"
          ? !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))
          : item.type === "text" && !String(value).trim()

  const save = async () => {
    const body = { value: item.type === "integer" ? n : value, reason: reason.trim() }
    const r = await run(() => attempt(() => api.put<ConfigItem>(`/settings/config/${item.key}`, body), "Saved. The earlier value is kept in the history."))
    if (r) {
      onSaved(r)
      close()
    }
  }

  return (
    <>
      <p className="font-medium break-words">{item.label}</p>
      {item.type === "boolean" ? (
        <label className="flex items-center gap-2">
          <Switch checked={value === true} onCheckedChange={setValue} />
          {value ? "On" : "Off"}
        </label>
      ) : item.type === "month_day" ? (
        <Field label="Day of the year">
          <Input
            type="date"
            value={`2024-${String(value)}`}
            onChange={(e) => setValue(e.target.value.slice(5))}
            className="h-8 text-foreground"
          />
        </Field>
      ) : item.type === "time" ? (
        <Field label="Time">
          <Input type="time" value={String(value)} onChange={(e) => setValue(e.target.value)} className="h-8 text-foreground" />
        </Field>
      ) : (
        <Field label={item.type === "integer" ? `${item.unit}${item.min !== null ? ` · ${item.min} to ${numberLabel(item.max ?? 0)}` : ""}` : "Value"}>
          <Input autoFocus type={item.type === "integer" ? "number" : "text"} min={item.min ?? undefined} max={item.max ?? undefined} value={String(value)} onChange={(e) => setValue(e.target.value)} className="h-8 text-foreground tabular-nums" />
        </Field>
      )}
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (kept in the history)" aria-label="Why" className="min-h-16" />
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={close}>
          Back
        </Button>
        <Button size="sm" disabled={invalid || busy} onClick={save}>
          Save
        </Button>
      </div>
    </>
  )
}

function HistoryDialog({ item, onClose }: { item: ConfigItem | null; onClose: () => void }) {
  const history = useApi<ConfigHistory>(item ? `/settings/config/${item.key}/history` : null)
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogTitle>{item?.label}</DialogTitle>
        <DialogDescription>Every value it has had, newest first. Nothing here can be changed.</DialogDescription>
        {history.loading ? (
          <Loading />
        ) : history.error ? (
          <p className="text-destructive">{history.error}</p>
        ) : (
          <ul className="max-h-[50dvh] divide-y overflow-y-auto rounded-lg border">
            {(history.data ?? []).map((h) => (
              <li key={h.version} className="grid grid-cols-[48px_minmax(0,1fr)_minmax(0,1.2fr)] gap-3 px-3 py-2">
                <span className="text-xs text-muted-foreground">v{h.version}</span>
                <span className="font-medium tabular-nums">{item ? display({ ...item, value: h.value }) : String(h.value)}</span>
                <span className="flex flex-col text-xs text-muted-foreground">
                  <span>
                    {h.by ?? "Unknown"} · {dateTimeLabel(h.at)}
                  </span>
                  {h.reason && <span className="text-foreground">{h.reason}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
