import { TriangleAlert } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"

import { EmailPreview } from "@/components/common/email-preview"
import { useApi } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { BrandTemplates, TemplateKind } from "@/lib/types"
import { cn } from "@/lib/utils"

import { LoadError, Loading } from "../settings/shared"
import { Card } from "./shared"

// What this brand would get: which outreach and booking templates (and why, from the template matrix), and every
// email filled with its details. Facts are used only when verified; empty fields are highlighted.

const TITLE: Record<TemplateKind, string> = { sequence: "Outreach sequence", booking: "Booking emails" }

export function BrandEmails({ brandId }: { brandId: string }) {
  const { can } = useSession()
  const data = useApi<BrandTemplates>(`/templates/brands/${brandId}`)
  const [kind, setKind] = useState<TemplateKind>("sequence")
  if (data.error) return <LoadError message={data.error} retry={data.reload} />
  if (!data.data) return <Loading />
  const d = data.data
  const r = d.results.find((x) => x.kind === kind)!
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(["sequence", "booking"] as TemplateKind[]).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={cn("rounded-md border px-2.5 py-1 text-sm", k === kind ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted")}>
            {TITLE[k]}
          </button>
        ))}
      </div>
      <Card title={r.template ? `${TITLE[kind]}: ${r.template.name} · version ${r.version}` : `${TITLE[kind]}: no template`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {r.template ? <>Chosen by the template matrix for <span className="font-medium text-foreground">{r.matchedBy}</span>.</> : "No cell of the template matrix fits this brand."}{" "}
            {d.contact ? <>Sent to {d.contact.name}{d.contact.email ? ` <${d.contact.email}>` : " (no email yet)"}, the {d.contact.why}.</> : "The brand has no contact yet."}
          </p>
          {r.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-xs text-[#b54708]">
              {r.warnings.map((w) => (
                <li key={w} className="flex items-start gap-1.5">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          )}
          {r.steps.length > 0 && <EmailPreview steps={r.steps} />}
          {can("settings.view") && (
            <p className="text-xs text-muted-foreground">
              Change the wording in <Link to="/settings?section=templates" className="text-primary hover:underline">Settings → Email templates</Link>, and which template brands get in <Link to="/settings?section=matrix" className="text-primary hover:underline">Settings → Template matrix</Link>.
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
