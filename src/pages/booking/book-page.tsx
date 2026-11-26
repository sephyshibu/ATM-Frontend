import { ArrowLeft, CalendarCheck, Clock, Globe, Video } from "lucide-react"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import { LogoMark } from "@/components/brand/logo"
import { Field } from "@/components/common/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import type { BookingQuestion, PublicEventInfo, SlotList } from "@/lib/types"

import { longWhen, SlotPicker, visitorZone } from "./slot-picker"

// The public booking page: /book/<name>. No sign-in. Left: what the call is. Then a day and a time (only open
// times for the next days the host set, in the visitor's own time zone), then the booking form the host set up.
// After booking: the confirmation, the meeting link, and an email with a link to reschedule or cancel.

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="mx-auto w-full max-w-[880px]">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">{children}</div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <LogoMark className="size-4" /> Asia Trade Management
        </p>
      </div>
    </div>
  )
}

const CONFERENCING = { GOOGLE_MEET: "Google Meet", CUSTOM_LINK: "Video call (link in the confirmation)", NONE: null } as const

export function BookPage() {
  const { handle = "" } = useParams()
  const info = useApi<PublicEventInfo>(`/public/book/${encodeURIComponent(handle)}`)
  const slots = useApi<SlotList>(`/public/book/${encodeURIComponent(handle)}/slots`)
  const [slot, setSlot] = useState<string | null>(null)
  const [step, setStep] = useState<"pick" | "form">("pick")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ startsAt: string; meetingUrl?: string } | null>(null)

  useEffect(() => {
    if (info.data) document.title = `${info.data.name} · ${info.data.hostName}`
  }, [info.data])

  if (info.error) {
    return (
      <PublicShell>
        <div className="p-10 text-center">
          <h1 className="text-lg font-semibold">This booking page isn't available</h1>
          <p className="mt-1 text-sm text-muted-foreground">The link may be closed or mistyped.</p>
        </div>
      </PublicShell>
    )
  }
  if (!info.data) return <PublicShell><p className="p-10 text-center text-sm text-muted-foreground">Loading…</p></PublicShell>
  const et = info.data

  if (done) {
    return (
      <PublicShell>
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <CalendarCheck className="size-10 text-[#17b26a]" />
          <h1 className="text-xl font-semibold">You're booked</h1>
          <p className="text-sm text-muted-foreground">
            {et.name} with {et.hostName}
            <br />
            <span className="font-medium text-foreground">{longWhen(done.startsAt)}</span> ({visitorZone})
          </p>
          {done.meetingUrl && (
            <a href={done.meetingUrl} target="_blank" rel="noopener noreferrer" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Join link
            </a>
          )}
          <p className="text-xs text-muted-foreground">A confirmation is on its way to {email}, with a link to reschedule or cancel.</p>
        </div>
      </PublicShell>
    )
  }

  const submit = async () => {
    setError("")
    const missing = et.questions.find((q) => q.required && !(answers[q.id] ?? "").trim())
    if (!name.trim()) return setError("Your name is required.")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.")
    if (missing) return setError(`${missing.label} is required.`)
    setBusy(true)
    try {
      const r = await api.post<{ startsAt: string; meetingUrl?: string }>(`/public/book/${encodeURIComponent(handle)}`, { name: name.trim(), email: email.trim(), start: slot, timezone: visitorZone, answers })
      setDone({ startsAt: r.startsAt, meetingUrl: r.meetingUrl })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong. Please try again."
      if (/no longer available|just taken|Pick a time/i.test(message)) {
        setSlot(null)
        setStep("pick")
        void slots.reload()
      }
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicShell>
      <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 border-b p-6 md:border-r md:border-b-0">
          <p className="text-sm text-muted-foreground">{et.hostName}{et.hostTitle ? `, ${et.hostTitle}` : ""}</p>
          <h1 className="text-xl font-semibold tracking-[-0.01em]">{et.name}</h1>
          <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Clock className="size-4" /> {et.durationMins} min</span>
            {CONFERENCING[et.conferencing] && <span className="flex items-center gap-2"><Video className="size-4" /> {CONFERENCING[et.conferencing]}</span>}
            <span className="flex items-center gap-2"><Globe className="size-4" /> {visitorZone}</span>
          </div>
          {et.description && <p className="border-t pt-3 text-sm whitespace-pre-wrap text-muted-foreground">{et.description}</p>}
          {slot && step === "form" && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary">{longWhen(slot)}</p>}
        </div>
        <div>
          {error && step === "pick" && <p className="mx-5 mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          {step === "pick" ? (
            <SlotPicker
              slots={slots.data?.slots ?? []}
              loading={!slots.data && !slots.error}
              value={slot}
              onChange={(s) => {
                setSlot(s)
                setError("")
              }}
              onContinue={() => setStep("form")}
              continueLabel="Next"
            />
          ) : (
            <div className="flex flex-col gap-4 p-6">
              <button type="button" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => setStep("pick")}>
                <ArrowLeft className="size-4" /> Change the time
              </button>
              <h2 className="text-base font-semibold">Your details</h2>
              <Field label="Name *">
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-9" />
              </Field>
              <Field label="Email *">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-9" />
              </Field>
              {et.questions.map((q) => (
                <QuestionField key={q.id} q={q} value={answers[q.id] ?? ""} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
              ))}
              {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
              <Button className="h-10" disabled={busy} onClick={() => void submit()}>
                {busy ? "Booking…" : "Confirm the booking"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </PublicShell>
  )
}

function QuestionField({ q, value, onChange }: { q: BookingQuestion; value: string; onChange: (v: string) => void }) {
  const label = `${q.label}${q.required ? " *" : ""}`
  return (
    <Field label={label}>
      {q.type === "textarea" ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-24" />
      ) : q.type === "select" || q.type === "yesno" ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            {(q.type === "yesno" ? ["Yes", "No"] : (q.options ?? [])).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={q.type === "email" ? "email" : q.type === "url" ? "url" : q.type === "phone" ? "tel" : q.type === "number" ? "text" : "text"}
          inputMode={q.type === "number" ? "decimal" : q.type === "phone" ? "tel" : undefined}
          placeholder={q.type === "url" ? "https://" : q.type === "phone" ? "+65 9123 4567" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9"
        />
      )}
      {q.help && <span className="text-xs text-muted-foreground">{q.help}</span>}
    </Field>
  )
}
