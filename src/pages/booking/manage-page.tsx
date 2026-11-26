import { CalendarX, Clock } from "lucide-react"
import { useState } from "react"
import { useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import type { ManageInfo, SlotList } from "@/lib/types"

import { PublicShell } from "./book-page"
import { longWhen, SlotPicker, visitorZone } from "./slot-picker"

// The booker's own link (/booking/<token>, from the confirmation email): see the booking, move it to another open
// time, or cancel it. No sign-in; the long random token is the key.

export function ManageBookingPage() {
  const { token = "" } = useParams()
  const info = useApi<ManageInfo>(`/public/booking/${encodeURIComponent(token)}`)
  const [mode, setMode] = useState<"view" | "move" | "cancel">("view")
  const slots = useApi<SlotList>(mode === "move" ? `/public/booking/${encodeURIComponent(token)}/slots` : null)
  const [slot, setSlot] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  if (info.error) return <PublicShell><div className="p-10 text-center"><h1 className="text-lg font-semibold">This booking link isn't valid</h1></div></PublicShell>
  if (!info.data) return <PublicShell><p className="p-10 text-center text-sm text-muted-foreground">Loading…</p></PublicShell>
  const b = info.data

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true)
    setMessage("")
    try {
      await fn()
      setMessage(done)
      setMode("view")
      setSlot(null)
      await info.reload()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong. Please try again.")
      if (mode === "move") void slots.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicShell>
      <div className="flex flex-col gap-2 border-b p-6">
        <p className="text-sm text-muted-foreground">{b.hostName}</p>
        <h1 className="text-xl font-semibold">{b.eventName}</h1>
        <p className="flex items-center gap-2 text-sm">
          <Clock className="size-4 text-muted-foreground" />
          <span className={b.status === "cancelled" ? "line-through text-muted-foreground" : "font-medium"}>{longWhen(b.startsAt)}</span>
          <span className="text-muted-foreground">({visitorZone})</span>
        </p>
        {b.status === "cancelled" && <p className="flex items-center gap-1.5 text-sm text-destructive"><CalendarX className="size-4" /> This booking is cancelled.</p>}
        {b.meetingUrl && b.status === "confirmed" && (
          <a href={b.meetingUrl} target="_blank" rel="noopener noreferrer" className="w-fit text-sm font-medium text-primary hover:underline">
            Join link
          </a>
        )}
        {message && <p className="rounded-md bg-muted px-3 py-2 text-sm">{message}</p>}
        {b.canChange && mode === "view" && (
          <div className="mt-2 flex gap-2">
            <Button variant="outline" onClick={() => setMode("move")}>Reschedule</Button>
            <Button variant="ghost" className="text-destructive" onClick={() => setMode("cancel")}>Cancel the booking</Button>
          </div>
        )}
      </div>
      {mode === "move" && (
        <SlotPicker
          slots={slots.data?.slots ?? []}
          loading={!slots.data && !slots.error}
          value={slot}
          onChange={setSlot}
          busy={busy}
          continueLabel="Move here"
          onContinue={() => void act(() => api.post(`/public/booking/${encodeURIComponent(token)}/reschedule`, { start: slot }), "Moved. A new confirmation is on its way to your email.")}
        />
      )}
      {mode === "cancel" && (
        <div className="flex flex-col gap-3 p-6">
          <p className="text-sm">Cancel this booking? You can book another time from the same link later.</p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="min-h-16" />
          <div className="flex gap-2">
            <Button variant="destructive" disabled={busy} onClick={() => void act(() => api.post(`/public/booking/${encodeURIComponent(token)}/cancel`, { reason: reason.trim() || undefined }), "Your booking is cancelled.")}>
              Cancel the booking
            </Button>
            <Button variant="ghost" onClick={() => setMode("view")}>Keep it</Button>
          </div>
        </div>
      )}
    </PublicShell>
  )
}
