// The app's toasts: call showToast from anywhere; the one Toaster is mounted by the admin layout.

import { Check, Hourglass, X } from "lucide-react"
import { useEffect, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { Link, useLocation } from "react-router-dom"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------- Toast

/** link: a page to open (`to`) or something to do (`onClick`). */
type Toast = { id: number; text: string; tone: "success" | "warning"; link?: { label: string; to: string } | { label: string; onClick: () => void } }
let toast: Toast | null = null
// A counter, not the time: two toasts in the same millisecond would share an id, and the first one's timer would clear the second early.
let toastSeq = 0
const toastListeners = new Set<() => void>()
const emit = () => toastListeners.forEach((f) => f())

/** A small message at the bottom of the screen for a few seconds. */
export function showToast(text: string, tone: Toast["tone"] = "success", link?: Toast["link"]) {
  const id = ++toastSeq
  toast = { id, text, tone, link }
  emit()
  window.setTimeout(() => {
    if (toast?.id !== id) return
    toast = null
    emit()
  }, link ? 9000 : 5500)
}

// One Toaster, mounted by the admin layout for every page, dialog and drawer.
// Should another ever be mounted, only the first one shows the toast.
const toasters: object[] = []
const subscribeToasts = (f: () => void) => {
  toastListeners.add(f)
  return () => {
    toastListeners.delete(f)
  }
}

export function Toaster() {
  const [me] = useState(() => ({}))
  useEffect(() => {
    toasters.push(me)
    emit()
    return () => {
      toasters.splice(toasters.indexOf(me), 1)
      emit()
    }
  }, [me])
  const t = useSyncExternalStore(subscribeToasts, () => toast, () => null)
  const first = useSyncExternalStore(subscribeToasts, () => toasters[0] === me, () => false)
  const { pathname, search } = useLocation()
  // An open enquiry has its composer at the bottom right: the toast sits above it.
  const composer = pathname.startsWith("/admin/enquiries") && (pathname !== "/admin/enquiries" || new URLSearchParams(search).has("enquiry"))
  if (!t || !first) return null
  // On the page's body, after any open dialog: above it, and not hidden from screen readers with the page behind it.
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      // Dialogs don't take a click on the toast for a click outside them (and close).
      data-app-toast="toast"
      className={cn(
        // Desktop: bottom right. Phones and tablets: full width, above the tab bar (or a floating add button).
        "pointer-events-auto fixed right-6 z-[60] flex max-w-[440px] items-start gap-2.5 rounded-lg border px-3.5 py-2.5 shadow-lg animate-in fade-in-0 slide-in-from-bottom-2 compact:right-3 compact:bottom-[calc(max(16px,env(safe-area-inset-bottom))+84px)] compact:left-3 compact:max-w-none",
        composer ? "bottom-36" : "bottom-6",
        // In dark the pastel fills become see-through tints; a floating toast needs them mixed into a solid surface.
        t.tone === "success"
          ? "border-[#abefc6] bg-[#ecfdf3] text-[#05603a] dark:bg-[color-mix(in_srgb,rgb(23_178_106)_14%,var(--popover))]"
          : "border-[#fedf89] bg-[#fffaeb] text-[#93370d] dark:bg-[color-mix(in_srgb,rgb(247_144_9)_14%,var(--popover))]"
      )}
    >
      {t.tone === "success" ? <Check className="mt-0.5 size-4 shrink-0" /> : <Hourglass className="mt-0.5 size-4 shrink-0" />}
      <span className="flex min-w-0 flex-col items-start gap-1">
        <span className="break-words">{t.text}</span>
        {t.link && "onClick" in t.link && (
          <button
            type="button"
            onClick={() => {
              toast = null
              emit()
              if (t.link && "onClick" in t.link) t.link.onClick()
            }}
            className="cursor-pointer font-medium underline underline-offset-4 outline-none hover:no-underline focus-visible:no-underline"
          >
            {t.link.label}
          </button>
        )}
        {t.link && "to" in t.link && (
          <Link
            to={t.link.to}
            onClick={() => {
              toast = null
              emit()
            }}
            className="font-medium underline underline-offset-4 outline-none hover:no-underline focus-visible:no-underline"
          >
            {t.link.label}
          </Link>
        )}
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          toast = null
          emit()
        }}
        className="-mr-1 ml-1 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded opacity-70 transition-opacity hover:opacity-100 compact:-my-2 compact:ml-auto compact:size-10"
      >
        <X className="size-3.5" />
      </button>
    </div>,
    document.body
  )
}
