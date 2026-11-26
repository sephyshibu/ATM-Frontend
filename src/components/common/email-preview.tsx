import { Clock } from "lucide-react"

import type { RenderedStep } from "@/lib/types"

// Filled-in emails, one card per step. Empty merge fields come back as ⟦Label⟧ and are highlighted.

function Highlight({ text }: { text: string }) {
  const parts = text.split(/(⟦[^⟧]*⟧)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("⟦") ? (
          <mark key={i} className="rounded bg-[#fffaeb] px-0.5 text-[#b54708]">
            {p.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

export function EmailPreview({ steps }: { steps: RenderedStep[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={s.step} className="overflow-hidden rounded-lg border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs">
            <span className="font-semibold">{s.name}</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              {i === 0 ? "On the release day" : `${s.delayDays} ${s.delayUnit ?? "days"} after the previous email`}
            </span>
          </div>
          <div className="flex flex-col gap-2 px-3 py-2.5">
            <p className="font-medium">
              <span className="text-muted-foreground">Subject: </span>
              <Highlight text={s.subject} />
            </p>
            <p className="text-sm whitespace-pre-wrap">
              <Highlight text={s.body} />
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
