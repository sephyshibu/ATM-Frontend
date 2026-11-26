import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// The day-and-time picker on the public booking page and the reschedule page. Slots come in as UTC and are
// grouped and shown in the visitor's own time zone (the browser's).

export const visitorZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA") // YYYY-MM-DD, local
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function SlotPicker({ slots, loading, value, onChange, onContinue, continueLabel = "Continue", busy }: { slots: string[]; loading: boolean; value: string | null; onChange: (iso: string | null) => void; onContinue: () => void; continueLabel?: string; busy?: boolean }) {
  const byDay = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const s of slots) {
      const k = dayKey(s)
      m.set(k, [...(m.get(k) ?? []), s])
    }
    return m
  }, [slots])
  const days = useMemo(() => [...byDay.keys()].sort(), [byDay])
  const [day, setDay] = useState<string | null>(null)
  const [month, setMonth] = useState<Date | null>(null)

  useEffect(() => {
    if (!month && days[0]) {
      const [y, m] = days[0].split("-").map(Number)
      setMonth(new Date(y, m - 1, 1))
    }
    if (day && !byDay.has(day)) setDay(null)
  }, [days, month, day, byDay])

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Finding open times…</p>
  if (!days.length) return <p className="p-6 text-sm text-muted-foreground">No open times in the coming days. Please check back later.</p>

  const m = month ?? new Date()
  const first = new Date(m.getFullYear(), m.getMonth(), 1)
  const count = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: count }, (_, i) => new Date(m.getFullYear(), m.getMonth(), i + 1).toLocaleDateString("en-CA"))]
  const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth()
  const minMonth = (() => {
    const [y, mo] = days[0].split("-").map(Number)
    return y * 12 + mo - 1
  })()
  const maxMonth = (() => {
    const [y, mo] = days[days.length - 1].split("-").map(Number)
    return y * 12 + mo - 1
  })()
  const today = new Date().toLocaleDateString("en-CA")
  const daySlots = day ? (byDay.get(day) ?? []) : []

  return (
    <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_200px]">
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">{m.toLocaleDateString([], { month: "long", year: "numeric" })}</span>
          <span className="flex gap-1">
            <Button size="icon-sm" variant="ghost" aria-label="Previous month" disabled={monthKey(m) <= minMonth} onClick={() => setMonth(new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
              <ChevronLeft />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Next month" disabled={monthKey(m) >= maxMonth} onClick={() => setMonth(new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
              <ChevronRight />
            </Button>
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Pick a day">
          {cells.map((c, i) => {
            if (!c) return <span key={`b${i}`} />
            const open = byDay.has(c)
            const picked = c === day
            return (
              <button
                key={c}
                type="button"
                disabled={!open}
                aria-pressed={picked}
                aria-label={`${new Date(`${c}T12:00:00`).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}${open ? "" : ", no open times"}`}
                onClick={() => {
                  setDay(c)
                  onChange(null)
                }}
                className={cn(
                  "mx-auto flex size-10 items-center justify-center rounded-full text-sm",
                  open ? "bg-primary/10 font-semibold text-primary hover:bg-primary/20" : "text-muted-foreground/50",
                  picked && "bg-primary text-primary-foreground hover:bg-primary",
                  c === today && !picked && "ring-1 ring-primary/40",
                )}
              >
                {Number(c.slice(8))}
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Times are shown in your time zone: {visitorZone}</p>
      </div>
      <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto border-t p-5 sm:border-t-0 sm:border-l">
        {!day ? (
          <p className="text-sm text-muted-foreground">Pick a day to see the times.</p>
        ) : (
          <>
            <p className="text-sm font-semibold">{new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</p>
            {daySlots.map((s) =>
              s === value ? (
                <div key={s} className="grid grid-cols-2 gap-1.5">
                  <span className="flex h-9 items-center justify-center rounded-md bg-muted text-sm font-medium">{timeLabel(s)}</span>
                  <Button className="h-9" disabled={busy} onClick={onContinue}>
                    {continueLabel}
                  </Button>
                </div>
              ) : (
                <Button key={s} variant="outline" className="h-9 border-primary/40 font-medium text-primary" onClick={() => onChange(s)}>
                  {timeLabel(s)}
                </Button>
              ),
            )}
          </>
        )}
      </div>
    </div>
  )
}

export const longWhen = (iso: string) => new Date(iso).toLocaleString([], { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })
