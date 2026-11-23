import { TriangleAlert } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { Field } from "@/components/common/form"
import { MultiPick, SearchPick } from "@/components/common/search-pick"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import { countryName } from "@/lib/records"
import type { Brand, BrandCheck, BrandDetail, Organisation, RecordOptions, TagRef } from "@/lib/types"

import { attempt, useBusy } from "../settings/shared"
import { CustomFieldInputs, customPayload, fieldsFor, missingRequired } from "./custom-fields"
import { TagPick } from "./tags"

// Add or edit a brand. The website is required: it's how the CRM spots a brand that's already in Records. While
// you type, a check shows any brand on the same website (which blocks saving) or with a similar name (a warning).

const NEW = "__new__"

export function BrandDialog(props: { open: boolean; brand?: Brand & { tags?: TagRef[] }; organisationId?: string; options?: RecordOptions; onClose: () => void; onSaved: (b: BrandDetail) => void }) {
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-[720px]">{props.open && <BrandForm {...props} />}</DialogContent>
    </Dialog>
  )
}

/** While typing: the duplicate check, a moment after the last key. */
function useDuplicateCheck(domain: string, name: string, exceptId?: string, organisationId?: string) {
  const [result, setResult] = useState<BrandCheck | null>(null)
  useEffect(() => {
    if (!domain.trim() && name.trim().length < 3 && !organisationId) {
      setResult(null)
      return
    }
    const t = window.setTimeout(async () => {
      const q = new URLSearchParams({ domain: domain.trim(), name: name.trim(), ...(exceptId ? { except: exceptId } : {}), ...(organisationId ? { organisationId } : {}) })
      try {
        setResult(await api.get<BrandCheck>(`/records/brands/check?${q}`))
      } catch {
        setResult(null)
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [domain, name, exceptId, organisationId])
  return result
}

function BrandForm({ brand, organisationId, options, onClose, onSaved }: { brand?: Brand & { tags?: TagRef[] }; organisationId?: string; options?: RecordOptions; onClose: () => void; onSaved: (b: BrandDetail) => void }) {
  const orgs = useApi<Organisation[]>("/records/organisations")
  const [name, setName] = useState(brand?.name ?? "")
  const [domain, setDomain] = useState(brand?.domain ?? "")
  const [orgId, setOrgId] = useState(brand?.organisationId ?? organisationId ?? "")
  const [newOrg, setNewOrg] = useState({ name: "", legalEntity: "", domain: "", hqCountry: "" })
  const [categoryCode, setCategory] = useState(brand?.categoryCode ?? "")
  const [subCategoryCode, setSub] = useState(brand?.subCategoryCode ?? "")
  const [routingCode, setRouting] = useState(brand?.routingCode ?? "")
  const [tierCode, setTier] = useState(brand?.tierCode ?? "")
  const [homeCountry, setHome] = useState(brand?.homeCountry ?? "")
  const [revenue, setRevenue] = useState(brand?.homeRevenueUsd != null ? String(brand.homeRevenueUsd) : "")
  const [revenueYear, setYear] = useState(brand?.revenueYear != null ? String(brand.revenueYear) : "")
  const [markets, setMarkets] = useState<string[]>(brand?.asianMarketsLive ?? [])
  const [ownerId, setOwner] = useState(brand?.ownerId ?? "")
  const [linkedinUrl, setLinkedin] = useState(brand?.linkedinUrl ?? "")
  const [description, setDescription] = useState(brand?.description ?? "")
  const [tagCodes, setTags] = useState<string[]>(brand?.tags?.map((t) => t.code) ?? [])
  const [custom, setCustom] = useState<Record<string, unknown>>(brand?.custom ?? {})
  const customFields = fieldsFor(options, "brand", brand?.custom)
  const customMissing = missingRequired(customFields, custom)
  const [tried, setTried] = useState(false)
  const [busy, run] = useBusy()
  const check = useDuplicateCheck(domain, name, brand?.id, orgId && orgId !== NEW ? orgId : undefined)

  const pick = (list: keyof RecordOptions["lists"], keep?: string | null) => (options?.lists[list] ?? []).filter((o) => !o.retired || o.code === keep).map((o) => ({ value: o.code, label: o.label + (o.retired ? " (retired)" : "") }))
  const countries = useMemo(() => (options?.countries ?? []).map((c) => ({ value: c, label: countryName(c), hint: c })).sort((a, b) => a.label.localeCompare(b.label)), [options])
  const subs = (options?.lists.sub_category ?? []).filter((o) => o.parentCode === categoryCode && (!o.retired || o.code === brand?.subCategoryCode)).map((o) => ({ value: o.code, label: o.label }))
  const orgOptions = [...(orgs.data ?? []).filter((o) => !o.archived).map((o) => ({ value: o.id, label: o.name, hint: o.domain ?? undefined })), ...(orgId === NEW ? [{ value: NEW, label: `New: ${newOrg.name}` }] : [])]
  const owners = (options?.owners ?? []).map((u) => ({ value: u.id, label: u.name, hint: u.email }))

  const revenueNumber = revenue.trim() === "" ? null : Number(revenue.replace(/[,\s]/g, ""))
  const blocking = check?.sameDomain[0]
  const error = !name.trim()
    ? "Give the brand a name."
    : !domain.trim()
      ? "Add the brand's website. It's how duplicates are caught."
      : !orgId
        ? "Pick the organisation the brand belongs to, or add a new one."
        : orgId === NEW && !newOrg.name.trim()
          ? "Give the new organisation a name."
          : !categoryCode || !subCategoryCode
            ? "Pick the brand's category and sub-category."
            : customMissing
              ? `${customMissing.label} is required.`
              : revenueNumber !== null && (!Number.isInteger(revenueNumber) || revenueNumber < 0)
            ? "Home revenue: whole US dollars, e.g. 12500000."
            : undefined

  const save = async () => {
    setTried(true)
    if (error || blocking) return
    const body = {
      name: name.trim(),
      domain: domain.trim(),
      ...(orgId === NEW ? (brand ? {} : { newOrganisation: { name: newOrg.name.trim(), legalEntity: newOrg.legalEntity, domain: newOrg.domain, hqCountry: newOrg.hqCountry } }) : { organisationId: orgId }),
      categoryCode,
      subCategoryCode,
      routingCode,
      tierCode,
      homeCountry,
      homeRevenueUsd: revenueNumber,
      revenueYear: revenueYear.trim() ? Number(revenueYear) : null,
      asianMarketsLive: markets,
      ownerId,
      linkedinUrl,
      description,
      tagCodes,
      custom: customPayload(customFields, custom),
    }
    const r = await run(() => attempt(() => (brand ? api.patch<BrandDetail>(`/records/brands/${brand.id}`, body) : api.post<BrandDetail>("/records/brands", body)), brand ? "Saved." : `${name.trim()} added.`))
    if (r) onSaved(r)
  }

  return (
    <>
      <div className="flex flex-col gap-1 border-b px-6 py-4">
        <DialogTitle>{brand ? `Edit ${brand.name}` : "Add a brand"}</DialogTitle>
        <DialogDescription>Name, website, organisation, category and sub-category are needed. The rest can be filled in later.</DialogDescription>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand name">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={tried && !name.trim()} className="h-8 text-foreground" />
          </Field>
          <Field label="Brand website">
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. glowco.com" aria-invalid={(tried && !domain.trim()) || !!blocking} className="h-8 text-foreground" />
          </Field>
        </div>

        {check && (check.sameDomain.length > 0 || check.similar.length > 0) && (
          <div className={`flex gap-2 rounded-lg border px-3 py-2 text-xs ${blocking ? "border-destructive/30 bg-destructive/5" : "border-[#fedf89] bg-[#fffaeb] text-[#93370d]"}`}>
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <div className="flex flex-col gap-1">
              {check.sameDomain.map((b) => (
                <span key={b.id}>
                  <Link to={`/records/brands/${b.id}`} className="font-semibold underline underline-offset-2" onClick={onClose}>
                    {b.name}
                  </Link>{" "}
                  ({b.organisation.name}) already uses {b.domain}
                  {b.archived ? " and is archived: restore it instead of adding it again." : ". Open it instead of adding it twice."}
                </span>
              ))}
              {check.similar.length > 0 && (
                <span>
                  Similar names already in Records:{" "}
                  {check.similar.map((b, i) => (
                    <span key={b.id}>
                      {i > 0 && ", "}
                      <Link to={`/records/brands/${b.id}`} className="font-medium underline underline-offset-2" onClick={onClose}>
                        {b.name}
                      </Link>{" "}
                      ({b.domain})
                    </span>
                  ))}
                  . Check it's not the same brand.
                </span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Organisation (the legal entity ATM signs with)" className="col-span-2">
            <SearchPick
              options={orgOptions}
              value={orgId}
              onChange={setOrgId}
              placeholder={orgs.loading ? "Loading…" : "Pick an organisation, or type a new one"}
              onCreate={
                brand
                  ? undefined
                  : (typed) => {
                      setNewOrg({ name: typed, legalEntity: "", domain: "", hqCountry: "" })
                      setOrgId(NEW)
                    }
              }
              createLabel={(t) => `Add the new organisation "${t}"`}
              required
              aria-label="Organisation"
            />
          </Field>
          {orgId === NEW && (
            <div className="col-span-2 grid grid-cols-2 gap-3 rounded-lg border border-dashed p-3">
              <Field label="New organisation name">
                <Input value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} className="h-8 text-foreground" />
              </Field>
              <Field label="Legal entity (registered name)">
                <Input value={newOrg.legalEntity} onChange={(e) => setNewOrg({ ...newOrg, legalEntity: e.target.value })} placeholder="e.g. Glow Cosmetics Pvt Ltd" className="h-8 text-foreground" />
              </Field>
              <Field label="Organisation website (optional)">
                <Input value={newOrg.domain} onChange={(e) => setNewOrg({ ...newOrg, domain: e.target.value })} className="h-8 text-foreground" />
              </Field>
              <Field label="Head office">
                <SearchPick options={countries} value={newOrg.hqCountry} onChange={(v) => setNewOrg({ ...newOrg, hqCountry: v })} aria-label="Head office" />
              </Field>
              {name.trim() && newOrg.name !== name.trim() && (
                <button type="button" onClick={() => setNewOrg({ ...newOrg, name: name.trim() })} className="col-span-2 w-fit text-xs text-primary hover:underline">
                  The brand signs on its own: use "{name.trim()}" as the organisation name
                </button>
              )}
            </div>
          )}
        </div>

        {check?.sameGroup && (
          <div className="flex gap-2 rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-xs text-[#93370d]">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Same group as {check.sameGroup.group.name}, which already has:{" "}
              {check.sameGroup.brands.map((b, i) => (
                <span key={b.id}>
                  {i > 0 && ", "}
                  <Link to={`/records/brands/${b.id}`} className="font-medium underline underline-offset-2" onClick={onClose}>
                    {b.name}
                  </Link>{" "}
                  ({b.organisation.name})
                </span>
              ))}
              . Check with their owner so the group isn't approached twice.
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Field label="Category">
            <SearchPick
              options={pick("category", brand?.categoryCode)}
              value={categoryCode}
              onChange={(v) => {
                setCategory(v)
                if (v !== categoryCode) setSub("")
              }}
              required
              aria-label="Category"
            />
          </Field>
          <Field label="Sub-category">
            <SearchPick options={subs} value={subCategoryCode} onChange={setSub} disabled={!categoryCode} placeholder={!categoryCode ? "Pick a category first" : subs.length ? "Choose" : "None yet: add one in Settings → Lists"} required aria-label="Sub-category" />
          </Field>
          <Field label="Lane">
            <SearchPick options={pick("routing", brand?.routingCode)} value={routingCode} onChange={setRouting} aria-label="Lane" />
          </Field>
          <Field label="Home country">
            <SearchPick options={countries} value={homeCountry} onChange={setHome} aria-label="Home country" />
          </Field>
          <Field label="Home revenue (USD)">
            <Input inputMode="numeric" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="e.g. 12500000" className="h-8 text-foreground tabular-nums" />
          </Field>
          <Field label="Revenue year">
            <Input inputMode="numeric" value={revenueYear} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="e.g. 2025" className="h-8 text-foreground tabular-nums" />
          </Field>
          <Field label="Asian markets already live" className="col-span-2">
            <MultiPick options={countries} values={markets} onChange={setMarkets} placeholder="None yet" aria-label="Asian markets already live" />
          </Field>
          <Field label="Tier">
            <SearchPick options={pick("tier", brand?.tierCode)} value={tierCode} onChange={setTier} aria-label="Tier" />
          </Field>
          <Field label="Owner at ATM">
            <SearchPick options={owners} value={ownerId} onChange={setOwner} aria-label="Owner" />
          </Field>
          <Field label="LinkedIn page" className="col-span-2">
            <Input value={linkedinUrl} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/company/…" className="h-8 text-foreground" />
          </Field>
          <Field label="Tags" className="col-span-3">
            <TagPick options={options} values={tagCodes} onChange={setTags} current={brand?.tags} />
          </Field>
          <CustomFieldInputs fields={customFields} values={custom} onChange={setCustom} tried={tried} />
          <Field label="About the brand" className="col-span-3">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-16 text-foreground" />
          </Field>
        </div>
        {tried && error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t px-6 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy || !!blocking}>
          {brand ? "Save" : "Add brand"}
        </Button>
      </div>
    </>
  )
}
