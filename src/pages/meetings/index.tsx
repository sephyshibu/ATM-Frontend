import { ArrowDown, ArrowUp, CalendarCheck, CalendarPlus, Copy, ExternalLink, Link2, Pencil, Plus, Trash2, Video, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, Navigate, useSearchParams } from "react-router-dom"

import { Chip } from "@/components/common/chip"
import { Field } from "@/components/common/form"
import { NotePanel } from "@/components/common/panels"
import { MoreMenu } from "@/components/common/more-menu"
import { showToast } from "@/components/common/toast"
import { TONES } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { AvailabilityWindow, BookingQuestion, BookingQuestionType, CalendarStatus, EventTypeView, HostBooking } from "@/lib/types"
import { cn } from "@/lib/utils"

import { attempt, LoadError, Loading, useBusy } from "../settings/shared"

// Meetings: your Google Calendar link, your booking pages (public links people use to book a call in the next
// days), and the bookings that came in with their form answers. Everyone sees only their own.

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const QUESTION_TYPES: { value: BookingQuestionType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "url", label: "Link" },
  { value: "number", label: "Number" },
  { value: "yesno", label: "Yes / no" },
  { value: "select", label: "One choice" },
]
const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
const fromTime = (t: string) => {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}
const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

export function MeetingsPage() {
  const { can } = useSession()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState("bookings")

  // Back from Google's consent page.
  useEffect(() => {
    const status = params.get("calendar")
    if (!status) return
    showToast(status === "connected" ? "Google Calendar connected. New bookings go on it with a Meet link." : `Couldn't connect Google Calendar: ${params.get("reason") ?? "try again"}`, status === "connected" ? undefined : "warning")
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.delete("calendar")
      n.delete("reason")
      return n
    }, { replace: true })
  }, [params, setParams])

  if (!can("records.view")) return <Navigate to="/no-access" replace />
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold tracking-[-0.01em]">Meetings</h1>
        <p className="text-muted-foreground">Your booking pages, the calls booked through them, and your Google Calendar.</p>
      </div>
      <CalendarCard />
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="pages">Booking pages</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings">{tab === "bookings" && <Bookings />}</TabsContent>
        <TabsContent value="pages">{tab === "pages" && <BookingPages />}</TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------- Google Calendar

function CalendarCard() {
  const cal = useApi<CalendarStatus>("/scheduling/calendar")
  const [busy, run] = useBusy()
  const c = cal.data
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
      <div className="flex min-w-0 items-start gap-3">
        <CalendarCheck className={cn("mt-0.5 size-5 shrink-0", c?.connected ? "text-[#17b26a]" : "text-muted-foreground")} />
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{c?.connected ? `Google Calendar connected: ${c.connected.email}` : "Google Calendar not connected"}</span>
          <span className="text-xs text-muted-foreground">
            {!c
              ? "Checking…"
              : c.connected
                ? "Busy times on your calendar are kept off your booking pages, and each booking goes on it with a Google Meet link."
                : c.configured
                  ? "Connect it so bookings land on your calendar with a Meet link, and your busy times are never offered."
                  : `The server isn't set up for it yet: add ${c.missing.join(" and ")} to the backend .env. Redirect URI to add in Google Cloud: ${c.callbackUrl}`}
          </span>
        </div>
      </div>
      {c && c.configured && (
        c.connected ? (
          <Button size="sm" variant="ghost" disabled={busy} onClick={async () => (await run(() => attempt(() => api.post("/scheduling/calendar/disconnect"), "Google Calendar disconnected."))) && cal.reload()}>
            Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              const r = await run(() => attempt(() => api.post<{ url: string }>("/scheduling/calendar/connect")))
              if (r) window.location.assign(r.url)
            }}
          >
            <CalendarPlus /> Connect Google Calendar
          </Button>
        )
      )}
      {cal.error && <LoadError message={cal.error} retry={cal.reload} />}
    </section>
  )
}

// ---------------------------------------------------------------- Bookings

function Bookings() {
  const [when2, setWhen] = useState<"upcoming" | "past" | "cancelled">("upcoming")
  const list = useApi<HostBooking[]>(`/scheduling/bookings?when=${when2}`)
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {(["upcoming", "past", "cancelled"] as const).map((w) => (
          <button key={w} type="button" onClick={() => setWhen(w)} className={cn("rounded-md border px-2.5 py-1 text-sm capitalize", w === when2 ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted")}>
            {w}
          </button>
        ))}
      </div>
      {list.error ? (
        <LoadError message={list.error} retry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">{when2 === "upcoming" ? "No upcoming bookings. Share a booking page link to get some." : "Nothing here."}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {list.data.map((b) => (
            <li key={b.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">
                    {b.inviteeName} <span className="font-normal text-muted-foreground">&lt;{b.inviteeEmail}&gt;</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {b.eventName} · {when(b.startsAt)}
                    {b.rescheduledFrom && ` · moved from ${when(b.rescheduledFrom)}`}
                  </span>
                  {b.status === "cancelled" && <span className="text-xs text-destructive">Cancelled by {b.cancelledBy}{b.cancelReason ? `: ${b.cancelReason}` : ""}</span>}
                </div>
                <span className="flex flex-wrap items-center gap-1.5">
                  {b.brand && (
                    <Link to={`/records/brands/${b.brand.id}`} className="text-sm text-primary hover:underline">
                      {b.brand.name}
                    </Link>
                  )}
                  {b.onCalendar && <Chip tone={TONES.GREEN}>On calendar</Chip>}
                  {b.meetingUrl && b.status === "confirmed" && (
                    <a href={b.meetingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                      <Video className="size-3.5" /> Join
                    </a>
                  )}
                  {b.answers.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setOpen(open === b.id ? null : b.id)}>
                      {open === b.id ? "Hide answers" : "Answers"}
                    </Button>
                  )}
                  {b.status === "confirmed" && new Date(b.startsAt) > new Date() && (
                    <MoreMenu
                      label={`More for ${b.inviteeName}`}
                      actions={[
                        {
                          label: "Cancel the booking",
                          icon: X,
                          destructive: true,
                          panel: (close) => (
                            <NotePanel
                              title={`Cancel ${b.inviteeName}'s booking?`}
                              placeholder="Reason (sent to them; optional)"
                              confirm="Cancel the booking"
                              destructive
                              close={close}
                              onConfirm={async (reason) => {
                                if (await attempt(() => api.post(`/scheduling/bookings/${b.id}/cancel`, { reason: reason || undefined }), "Booking cancelled. They've been emailed.")) void list.reload()
                              }}
                            />
                          ),
                        },
                      ]}
                    />
                  )}
                </span>
              </div>
              {open === b.id && (
                <dl className="grid gap-x-4 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-sm sm:grid-cols-[200px_1fr]">
                  {b.answers.map((a) => (
                    <div key={a.label} className="contents">
                      <dt className="text-muted-foreground">{a.label}</dt>
                      <dd className="whitespace-pre-wrap">{a.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Booking pages

function BookingPages() {
  const list = useApi<EventTypeView[]>("/scheduling/event-types")
  const [editing, setEditing] = useState<EventTypeView | "new" | null>(null)
  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      showToast("Link copied.")
    } catch {
      showToast(link)
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus /> New booking page
        </Button>
      </div>
      {list.error ? (
        <LoadError message={list.error} retry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">No booking pages yet. Make one, then share its link (for example in the booking emails).</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.data.map((et) => (
            <li key={et.id} className={cn("flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs", (et.archived || !et.active) && "opacity-70")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold">{et.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {et.durationMins} min · next {et.dateRangeDays} days · {et.questions.length} form {et.questions.length === 1 ? "question" : "questions"} · {et.upcoming} upcoming
                  </span>
                </div>
                {et.archived ? <Chip tone={TONES.MUTED}>Archived</Chip> : et.active ? <Chip tone={TONES.GREEN}>Live</Chip> : <Chip tone={TONES.AMBER}>Off</Chip>}
              </div>
              <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Link2 className="size-3.5 shrink-0" /> <span className="truncate">{et.link}</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => void copy(et.link)} disabled={et.archived}>
                  <Copy /> Copy link
                </Button>
                <a href={et.link} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-sm hover:bg-muted">
                  <ExternalLink className="size-4" /> Open
                </a>
                {!et.archived && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(et)}>
                    <Pencil /> Edit
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (await attempt(() => api.post(`/scheduling/event-types/${et.id}/${et.archived ? "restore" : "archive"}`), et.archived ? "Restored." : "Archived. Its link stops working; bookings are kept.")) void list.reload()
                  }}
                >
                  {et.archived ? "Restore" : "Archive"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <EventTypeEditor
          et={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void list.reload()
          }}
        />
      )}
    </div>
  )
}

const DEFAULT_HOURS: AvailabilityWindow[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 10 * 60, endMinute: 18 * 60 }))
const DEFAULT_QUESTIONS: BookingQuestion[] = [
  { id: "company", label: "Company", type: "text", required: true },
  { id: "website", label: "Company website", type: "url", required: false },
  { id: "phone", label: "Phone", type: "phone", required: false },
  { id: "notes", label: "What would you like to discuss?", type: "textarea", required: false },
]
const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"

function EventTypeEditor({ et, onClose, onSaved }: { et: EventTypeView | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(et?.name ?? "Qualifying call")
  const [description, setDescription] = useState(et?.description ?? "")
  const [duration, setDuration] = useState(String(et?.durationMins ?? 30))
  const [conferencing, setConferencing] = useState<EventTypeView["conferencing"]>(et?.conferencing ?? "GOOGLE_MEET")
  const [customLink, setCustomLink] = useState(et?.customLink ?? "")
  const [days, setDays] = useState(String(et?.dateRangeDays ?? 20))
  const [notice, setNotice] = useState(String(Math.round((et?.minNoticeMins ?? 240) / 60)))
  const [before, setBefore] = useState(String(et?.bufferBeforeMins ?? 0))
  const [after, setAfter] = useState(String(et?.bufferAfterMins ?? 10))
  const [step, setStep] = useState(String(et?.slotIncrementMins ?? 30))
  const [maxPerDay, setMaxPerDay] = useState(et?.maxPerDay ? String(et.maxPerDay) : "")
  const [timezone, setTimezone] = useState(et?.timezone ?? browserZone)
  const [active, setActive] = useState(et?.active ?? true)
  const [hours, setHours] = useState<AvailabilityWindow[]>(et?.availability ?? DEFAULT_HOURS)
  const [questions, setQuestions] = useState<BookingQuestion[]>(et?.questions ?? DEFAULT_QUESTIONS)
  const [busy, run] = useBusy()

  const setQ = (i: number, patch: Partial<BookingQuestion>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  const moveQ = (i: number, d: -1 | 1) =>
    setQuestions((qs) => {
      const n = [...qs]
      const [x] = n.splice(i, 1)
      n.splice(i + d, 0, x)
      return n
    })

  const save = async () => {
    const body = {
      name: name.trim(),
      description: description.trim(),
      durationMins: Number(duration),
      conferencing,
      customLink: conferencing === "CUSTOM_LINK" ? customLink.trim() : undefined,
      dateRangeDays: Number(days),
      minNoticeMins: Math.round(Number(notice) * 60),
      bufferBeforeMins: Number(before),
      bufferAfterMins: Number(after),
      slotIncrementMins: Number(step),
      maxPerDay: maxPerDay ? Number(maxPerDay) : null,
      timezone: timezone.trim(),
      active,
      availability: hours,
      questions: questions.map((q) => ({ id: q.id || undefined, label: q.label.trim(), type: q.type, required: q.required, options: q.type === "select" ? q.options ?? [] : undefined, help: q.help?.trim() || undefined })),
    }
    const ok = await run(() => attempt(() => (et ? api.put(`/scheduling/event-types/${et.id}`, body) : api.post("/scheduling/event-types", body)), et ? "Booking page saved." : "Booking page created. Copy its link to share it."))
    if (ok) onSaved()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-[900px]">
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <DialogTitle>{et ? `Edit ${et.name}` : "New booking page"}</DialogTitle>
          <DialogDescription>People with the link pick a day and time in the next {days || "…"} days within your hours, then fill in the form below.</DialogDescription>
        </div>
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Field label="Name (also the link: /book/…)">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-foreground" />
            </Field>
            <Field label="Description (shown on the page)">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-16 text-foreground" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Length (minutes)">
                <Input type="number" min={5} max={480} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} className="h-8 text-foreground" />
              </Field>
              <Field label="Bookable for the next (days)">
                <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} className="h-8 text-foreground" />
              </Field>
              <Field label="Earliest booking (hours from now)">
                <Input type="number" min={0} max={720} value={notice} onChange={(e) => setNotice(e.target.value)} className="h-8 text-foreground" />
              </Field>
              <Field label="Start times every (minutes)">
                <Input type="number" min={5} max={240} step={5} value={step} onChange={(e) => setStep(e.target.value)} className="h-8 text-foreground" />
              </Field>
              <Field label="Break before (minutes)">
                <Input type="number" min={0} max={240} value={before} onChange={(e) => setBefore(e.target.value)} className="h-8 text-foreground" />
              </Field>
              <Field label="Break after (minutes)">
                <Input type="number" min={0} max={240} value={after} onChange={(e) => setAfter(e.target.value)} className="h-8 text-foreground" />
              </Field>
              <Field label="Most bookings a day (empty = no limit)">
                <Input type="number" min={1} max={100} value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value)} className="h-8 text-foreground" />
              </Field>
              <Field label="Time zone of your hours">
                <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Kolkata" className="h-8 text-foreground" />
              </Field>
            </div>
            <Field label="Meeting">
              <Select value={conferencing} onValueChange={(v) => setConferencing(v as EventTypeView["conferencing"])}>
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GOOGLE_MEET">Google Meet (made on your connected calendar)</SelectItem>
                  <SelectItem value="CUSTOM_LINK">My own meeting link (Zoom, Teams…)</SelectItem>
                  <SelectItem value="NONE">No video link</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {conferencing === "CUSTOM_LINK" && (
              <Field label="Meeting link">
                <Input value={customLink} onChange={(e) => setCustomLink(e.target.value)} placeholder="https://zoom.us/j/…" className="h-8 text-foreground" />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} aria-label="Live" /> Live (the link takes bookings)
            </label>

            <h3 className="mt-2 font-semibold">Weekly hours</h3>
            <div className="flex flex-col gap-1.5">
              {WEEKDAYS.map((label, weekday) => {
                const rows = hours.map((w, i) => ({ w, i })).filter((x) => x.w.weekday === weekday)
                return (
                  <div key={weekday} className="flex items-start gap-2">
                    <label className="flex w-28 shrink-0 items-center gap-2 pt-1.5 text-sm">
                      <Switch
                        checked={rows.length > 0}
                        onCheckedChange={(on) => setHours((h) => (on ? [...h, { weekday, startMinute: 600, endMinute: 1080 }] : h.filter((w) => w.weekday !== weekday)))}
                        aria-label={`${label} available`}
                      />
                      {label.slice(0, 3)}
                    </label>
                    <div className="flex flex-col gap-1">
                      {rows.length === 0 && <span className="pt-1.5 text-sm text-muted-foreground">Unavailable</span>}
                      {rows.map(({ w, i }) => (
                        <span key={i} className="flex items-center gap-1.5">
                          <Input type="time" value={toTime(w.startMinute)} onChange={(e) => setHours((h) => h.map((x, j) => (j === i ? { ...x, startMinute: fromTime(e.target.value) } : x)))} className="h-8 w-28 text-foreground" />
                          –
                          <Input type="time" value={toTime(w.endMinute === 1440 ? 1439 : w.endMinute)} onChange={(e) => setHours((h) => h.map((x, j) => (j === i ? { ...x, endMinute: fromTime(e.target.value) } : x)))} className="h-8 w-28 text-foreground" />
                          <Button size="icon-xs" variant="ghost" aria-label="Remove these hours" onClick={() => setHours((h) => h.filter((_, j) => j !== i))}>
                            <X />
                          </Button>
                          {rows[rows.length - 1].i === i && (
                            <Button size="icon-xs" variant="ghost" aria-label="Add more hours" onClick={() => setHours((h) => [...h, { weekday, startMinute: Math.min(w.endMinute + 60, 1380), endMinute: Math.min(w.endMinute + 120, 1439) }])}>
                              <Plus />
                            </Button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-end justify-between">
              <div className="flex flex-col">
                <h3 className="font-semibold">Booking form</h3>
                <p className="text-xs text-muted-foreground">Name and email are always asked. The answers come into Meetings → Bookings and the booking email.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setQuestions((qs) => [...qs, { id: "", label: "", type: "text", required: false }])}>
                <Plus /> Add a question
              </Button>
            </div>
            {questions.map((q, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-1.5">
                  <Input value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} placeholder="Question" className="h-8 flex-1 text-foreground" />
                  <Button size="icon-xs" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => moveQ(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Move down" disabled={i === questions.length - 1} onClick={() => moveQ(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Remove the question" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={q.type} onValueChange={(v) => setQ(i, { type: v as BookingQuestionType })}>
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={q.required} onCheckedChange={(v) => setQ(i, { required: v })} aria-label="Required" /> Required
                  </label>
                </div>
                {q.type === "select" && (
                  <Textarea value={(q.options ?? []).join("\n")} onChange={(e) => setQ(i, { options: e.target.value.split("\n") })} placeholder={"One option per line\nHealth supplements\nBeauty & wellness"} className="min-h-20 text-foreground" />
                )}
                <Input value={q.help ?? ""} onChange={(e) => setQ(i, { help: e.target.value })} placeholder="Hint under the question (optional)" className="h-8 text-foreground" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || name.trim().length < 2} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
