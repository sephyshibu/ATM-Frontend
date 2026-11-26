import { useMemo, useState } from "react"

import { Field } from "@/components/common/form"
import { SearchPick } from "@/components/common/search-pick"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import { countryName, missingBuiltIn, personName, requiredSet } from "@/lib/records"
import type { Organisation, OrganisationDetail, Person, PersonRow, RecordOptions } from "@/lib/types"

import { attempt, useBusy } from "../settings/shared"
import { CustomFieldInputs, customPayload, fieldsFor, missingRequired } from "./custom-fields"

// Add or edit a person. A person belongs to one organisation and can work on several of its brands. An email belongs
// to one active person, so the same contact isn't added twice.

export function PersonDialog(props: { open: boolean; person?: Person; organisationId?: string; brandId?: string; options?: RecordOptions; onClose: () => void; onSaved: (p: PersonRow) => void }) {
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-[640px]">{props.open && <PersonForm {...props} />}</DialogContent>
    </Dialog>
  )
}

function PersonForm({ person, organisationId, brandId, options, onClose, onSaved }: { person?: Person; organisationId?: string; brandId?: string; options?: RecordOptions; onClose: () => void; onSaved: (p: PersonRow) => void }) {
  const fixedOrg = person?.organisationId ?? organisationId
  const orgs = useApi<Organisation[]>(fixedOrg ? null : "/records/organisations")
  const [orgId, setOrgId] = useState(fixedOrg ?? "")
  const org = useApi<OrganisationDetail>(!person && orgId ? `/records/organisations/${orgId}` : null)
  const [firstName, setFirst] = useState(person?.firstName ?? "")
  const [lastName, setLast] = useState(person?.lastName ?? "")
  const [jobTitle, setTitle] = useState(person?.jobTitle ?? "")
  const [email, setEmail] = useState(person?.email ?? "")
  const [emailStatus, setEmailStatus] = useState<Person["emailStatus"]>(person?.emailStatus ?? "unknown")
  const [phone, setPhone] = useState(person?.phone ?? "")
  const [linkedinUrl, setLinkedin] = useState(person?.linkedinUrl ?? "")
  const [country, setCountry] = useState(person?.country ?? "")
  const [buyingRoleCode, setRole] = useState(person?.buyingRoleCode ?? "")
  const [consentCode, setConsent] = useState(person?.consentCode ?? "")
  const [notes, setNotes] = useState(person?.notes ?? "")
  const [brandIds, setBrandIds] = useState<string[]>(brandId ? [brandId] : [])
  const [tried, setTried] = useState(false)
  const [busy, run] = useBusy()
  const [custom, setCustom] = useState<Record<string, unknown>>(person?.custom ?? {})

  const countries = useMemo(() => (options?.countries ?? []).map((c) => ({ value: c, label: countryName(c), hint: c })).sort((a, b) => a.label.localeCompare(b.label)), [options])
  const pick = (list: keyof RecordOptions["lists"], keep?: string | null) => (options?.lists[list] ?? []).filter((o) => !o.retired || o.code === keep).map((o) => ({ value: o.code, label: o.label }))
  const activeBrands = (org.data?.brands ?? []).filter((b) => !b.archivedAt)

  const customFields = fieldsFor(options, "person", person?.custom)
  const customMissing = missingRequired(customFields, custom)
  // Required built-in fields come from Settings → Fields (the work email by default).
  const req = requiredSet(options, "person")
  const builtInMissing = missingBuiltIn(
    req,
    [
      { key: "lastName", label: "Last name", value: lastName, before: person?.lastName },
      { key: "jobTitle", label: "Job title", value: jobTitle, before: person?.jobTitle },
      { key: "email", label: "Work email", value: email, before: person?.email },
      { key: "phone", label: "Phone", value: phone, before: person?.phone },
      { key: "country", label: "Country", value: country, before: person?.country },
      { key: "linkedin", label: "LinkedIn profile", value: linkedinUrl, before: person?.linkedinUrl },
      { key: "buyingRole", label: "Buying role", value: buyingRoleCode, before: person?.buyingRoleCode },
      { key: "consent", label: "Consent to contact", value: consentCode, before: person?.consentCode },
      { key: "notes", label: "Notes", value: notes, before: person?.notes },
    ],
    !!person,
  )
  const error = !firstName.trim()
    ? "Add a first name."
    : !orgId
      ? "Pick the organisation they work for."
      : builtInMissing
        ? builtInMissing
        : email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
          ? "Enter a valid email address."
          : customMissing
            ? `${customMissing.label} is required.`
            : undefined

  const save = async () => {
    setTried(true)
    if (error) return
    const fields = { firstName: firstName.trim(), lastName: lastName.trim(), jobTitle: jobTitle.trim(), email, emailStatus, phone, linkedinUrl, country, buyingRoleCode, consentCode, notes, custom: customPayload(customFields, custom) }
    const r = await run(() =>
      attempt(
        () => (person ? api.patch<PersonRow>(`/records/people/${person.id}`, fields) : api.post<PersonRow>("/records/people", { ...fields, organisationId: orgId, brandIds })),
        person ? "Saved." : `${personName({ firstName, lastName })} added.`,
      ),
    )
    if (r) onSaved(r)
  }

  return (
    <>
      <div className="flex flex-col gap-1 border-b px-6 py-4">
        <DialogTitle>{person ? `Edit ${personName(person)}` : "Add a person"}</DialogTitle>
        <DialogDescription>Someone at the brand's organisation: a contact for outreach and calls.</DialogDescription>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        {!fixedOrg && (
          <Field label="Organisation">
            <SearchPick
              options={(orgs.data ?? []).filter((o) => !o.archived).map((o) => ({ value: o.id, label: o.name, hint: o.domain ?? undefined }))}
              value={orgId}
              onChange={(v) => {
                setOrgId(v)
                setBrandIds([])
              }}
              required
              placeholder={orgs.loading ? "Loading…" : "Pick an organisation"}
              aria-label="Organisation"
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input autoFocus value={firstName} onChange={(e) => setFirst(e.target.value)} aria-invalid={tried && !firstName.trim()} className="h-8 text-foreground" />
          </Field>
          <Field label="Last name">
            <Input value={lastName} onChange={(e) => setLast(e.target.value)} className="h-8 text-foreground" />
          </Field>
          <Field label="Job title" className="col-span-2">
            <Input value={jobTitle} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Head of International" className="h-8 text-foreground" />
          </Field>
          <Field label={req.has("email") ? "Work email *" : "Work email"}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={tried && req.has("email") && !email.trim()} className="h-8 text-foreground" />
          </Field>
          <Field label="Email check">
            <Select value={email.trim() ? emailStatus : "unknown"} onValueChange={(v) => setEmailStatus(v as Person["emailStatus"])} disabled={!email.trim()}>
              <SelectTrigger size="sm" className="w-full bg-card" aria-label="Email check">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Not checked</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="invalid">Bounced or invalid</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-foreground" />
          </Field>
          <Field label="Country">
            <SearchPick options={countries} value={country} onChange={setCountry} aria-label="Country" />
          </Field>
          <Field label="LinkedIn profile" className="col-span-2">
            <Input value={linkedinUrl} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/…" className="h-8 text-foreground" />
          </Field>
          <Field label="Buying role">
            <SearchPick options={pick("buying_role", person?.buyingRoleCode)} value={buyingRoleCode} onChange={setRole} aria-label="Buying role" />
          </Field>
          <Field label="Consent to contact">
            <SearchPick options={pick("consent_basis", person?.consentCode)} value={consentCode} onChange={setConsent} aria-label="Consent to contact" />
          </Field>
          <CustomFieldInputs fields={customFields} values={custom} onChange={setCustom} tried={tried} />
          <Field label="Notes" className="col-span-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-14 text-foreground" />
          </Field>
        </div>
        {!person && orgId && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Works on these brands</span>
            {activeBrands.length ? (
              <ul className="divide-y rounded-lg border">
                {activeBrands.map((b) => (
                  <li key={b.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40">
                      <Checkbox checked={brandIds.includes(b.id)} onCheckedChange={(v) => setBrandIds((ids) => (v === true ? [...ids, b.id] : ids.filter((x) => x !== b.id)))} />
                      <span className="font-medium">{b.name}</span>
                      <span className="text-xs text-muted-foreground">{b.domain}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{org.loading ? "Loading brands…" : "This organisation has no brands yet."}</p>
            )}
          </div>
        )}
        {tried && error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t px-6 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {person ? "Save" : "Add person"}
        </Button>
      </div>
    </>
  )
}
