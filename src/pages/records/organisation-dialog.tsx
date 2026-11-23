import { useState } from "react"

import { Field } from "@/components/common/form"
import { SearchPick } from "@/components/common/search-pick"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import { countryName } from "@/lib/records"
import type { Organisation, OrganisationDetail, RecordOptions } from "@/lib/types"

import { attempt, useBusy } from "../settings/shared"
import { TagPick } from "./tags"

// Add or edit an organisation: the legal entity ATM signs with, holding one or more brands (a brand that signs on
// its own is registered as its own organisation). It can sit inside a bigger parent group (another organisation), has a registered legal name for agreements and invoices, and can be
// excluded: nobody approaches it or its brands. Turning the exclusion on or off needs a reason.

export function OrganisationDialog({ open, org, options, onClose, onSaved }: { open: boolean; org?: Organisation; options?: RecordOptions; onClose: () => void; onSaved: (o: OrganisationDetail) => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-[600px]">{open && <OrganisationForm org={org} options={options} onClose={onClose} onSaved={onSaved} />}</DialogContent>
    </Dialog>
  )
}

function OrganisationForm({ org, options, onClose, onSaved }: { org?: Organisation; options?: RecordOptions; onClose: () => void; onSaved: (o: OrganisationDetail) => void }) {
  const all = useApi<Organisation[]>("/records/organisations")
  const [name, setName] = useState(org?.name ?? "")
  const [legalEntity, setLegal] = useState(org?.legalEntity ?? "")
  const [domain, setDomain] = useState(org?.domain ?? "")
  const [parentId, setParent] = useState(org?.parentId ?? "")
  const [hqCountry, setHq] = useState(org?.hqCountry ?? "")
  const [linkedinUrl, setLinkedin] = useState(org?.linkedinUrl ?? "")
  const [notes, setNotes] = useState(org?.notes ?? "")
  const [tagCodes, setTags] = useState<string[]>(org?.tags?.map((t) => t.code) ?? [])
  const [excluded, setExcluded] = useState(org?.excluded ?? false)
  const [why, setWhy] = useState("")
  const [tried, setTried] = useState(false)
  const [busy, run] = useBusy()
  const countries = (options?.countries ?? []).map((c) => ({ value: c, label: countryName(c), hint: c })).sort((a, b) => a.label.localeCompare(b.label))
  const groups = (all.data ?? []).filter((o) => !o.archived && o.id !== org?.id).map((o) => ({ value: o.id, label: o.name, hint: o.domain ?? undefined }))
  const exclusionChanged = excluded !== (org?.excluded ?? false)

  const error = !name.trim() ? "Give the organisation a name." : exclusionChanged && !why.trim() ? (excluded ? "Say why this organisation is excluded." : "Say why the exclusion is lifted.") : undefined

  const save = async () => {
    setTried(true)
    if (error) return
    const body = { name: name.trim(), legalEntity, domain, parentId: parentId || null, hqCountry, linkedinUrl, notes, tagCodes, ...(exclusionChanged ? { excluded, exclusionReason: why.trim() } : {}) }
    const r = await run(() => attempt(() => (org ? api.patch<OrganisationDetail>(`/records/organisations/${org.id}`, body) : api.post<OrganisationDetail>("/records/organisations", body)), org ? "Saved." : `${name.trim()} added.`))
    if (r) onSaved(r)
  }

  return (
    <>
      <div className="flex flex-col gap-1 border-b px-6 py-4">
        <DialogTitle>{org ? `Edit ${org.name}` : "Add an organisation"}</DialogTitle>
        <DialogDescription>The legal entity ATM signs with. Its brands, and the people who work there, sit under it.</DialogDescription>
      </div>
      <div className="grid grid-cols-2 gap-3 overflow-y-auto px-6 py-5">
        <Field label="Organisation name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={tried && !name.trim()} placeholder="e.g. Glow Cosmetics" className="h-8 text-foreground" />
        </Field>
        <Field label="Legal entity (registered name)">
          <Input value={legalEntity} onChange={(e) => setLegal(e.target.value)} placeholder="e.g. Glow Cosmetics Pvt Ltd" className="h-8 text-foreground" />
        </Field>
        <Field label="Organisation website (optional)">
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. glowcosmetics.com" className="h-8 text-foreground" />
        </Field>
        <Field label="Head office country">
          <SearchPick options={countries} value={hqCountry} onChange={setHq} placeholder="Choose" aria-label="Head office country" />
        </Field>
        <Field label="Parent group (optional)" className="col-span-2">
          <SearchPick options={groups} value={parentId} onChange={setParent} placeholder={all.loading ? "Loading…" : "None: it isn't part of a bigger group"} aria-label="Parent group" />
        </Field>
        <p className="col-span-2 -mt-1 text-xs text-muted-foreground">If the parent group isn't in Records yet, add it as an organisation first, then pick it here.</p>
        <Field label="LinkedIn page" className="col-span-2">
          <Input value={linkedinUrl} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/company/…" className="h-8 text-foreground" />
        </Field>
        <Field label="Tags" className="col-span-2">
          <TagPick options={options} values={tagCodes} onChange={setTags} current={org?.tags} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16 text-foreground" />
        </Field>

        <div className={`col-span-2 flex flex-col gap-2 rounded-lg border p-3 ${excluded ? "border-destructive/30 bg-destructive/5" : ""}`}>
          <label className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="font-medium">Excluded</span>
              <span className="text-xs text-muted-foreground">Don't approach this organisation or any of its brands and people.</span>
            </span>
            <Switch checked={excluded} onCheckedChange={setExcluded} aria-label="Excluded" />
          </label>
          {org?.excluded && !exclusionChanged && org.exclusionReason && <p className="text-xs">Why: {org.exclusionReason}</p>}
          {exclusionChanged && (
            <Field label={excluded ? "Why is it excluded?" : "Why is the exclusion lifted?"}>
              <Textarea value={why} onChange={(e) => setWhy(e.target.value)} aria-invalid={tried && !why.trim()} placeholder={excluded ? "e.g. Already a client through a partner" : "e.g. The partner agreement ended"} className="min-h-14 text-foreground" />
            </Field>
          )}
        </div>
        {tried && error && <p className="col-span-2 text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t px-6 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {org ? "Save" : "Add organisation"}
        </Button>
      </div>
    </>
  )
}
