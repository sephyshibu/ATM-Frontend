import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, Pencil, Plus } from "lucide-react"
import { useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"

import { Chip } from "@/components/common/chip"
import { MoreMenu } from "@/components/common/more-menu"
import { MUTED, RED } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, useApi } from "@/lib/api"
import { dateLabel } from "@/lib/format"
import { countryName, optionLabel, personName, siteUrl, useRecordOptions } from "@/lib/records"
import { useSession } from "@/lib/session"
import type { AuditEntry, OrganisationDetail, PersonRow } from "@/lib/types"

import { attempt, LoadError, Loading } from "../settings/shared"
import { BrandDialog } from "./brand-dialog"
import { OrganisationDialog } from "./organisation-dialog"
import { PersonActions } from "./person-actions"
import { PersonDialog } from "./person-dialog"
import { ArchivePanel, Card, EmailStatus, HistoryList, Row } from "./shared"

// One company: its details, its brands, everyone who works there, and its history.

export function OrganisationPage() {
  const { id = "" } = useParams()
  const { can } = useSession()
  const navigate = useNavigate()
  const options = useRecordOptions()
  const org = useApi<OrganisationDetail>(`/records/organisations/${id}`)
  const people = useApi<PersonRow[]>(`/records/people?organisationId=${id}&archived=true`)
  const [tab, setTab] = useState("details")
  const history = useApi<AuditEntry[]>(tab === "history" ? `/records/organisations/${id}/history` : null)
  const [editing, setEditing] = useState(false)
  const [addingBrand, setAddingBrand] = useState(false)
  const [addingPerson, setAddingPerson] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  if (!can("records.view")) return <Navigate to="/no-access" replace />
  if (org.error) return <LoadError message={org.error} retry={org.reload} />
  if (!org.data) return <Loading />

  const c = org.data
  const o = options.data
  const refresh = () => {
    void org.reload()
    void people.reload()
    if (tab === "history") void history.reload()
  }
  const editable = can("records.edit") && !c.archived
  const brands = c.brands.filter((b) => showArchived || !b.archivedAt)
  const staff = (people.data ?? []).filter((p) => showArchived || !p.archived)
  const activeBrands = c.brands.filter((b) => !b.archivedAt).length
  const activePeople = (people.data ?? []).filter((p) => !p.archived).length
  const activeMembers = c.members.filter((m) => !m.archivedAt).length
  const archivedCount = c.brands.length - activeBrands + (people.data?.length ?? 0) - activePeople + c.members.length - activeMembers

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link to="/records?tab=companies" className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Companies
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-[-0.01em]">
              {c.name}
              {c.excluded && <Chip tone={RED}>Excluded</Chip>}
              {c.archived && <Chip tone={MUTED}>Archived</Chip>}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
              {c.domain && (
                <a href={siteUrl(c.domain)} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                  {c.domain} <ExternalLink className="size-3" />
                </a>
              )}
              {c.hqCountry && <span>Head office: {countryName(c.hqCountry)}</span>}
              {c.parent && (
                <span>
                  Part of{" "}
                  <Link to={`/records/organisations/${c.parent.id}`} className="hover:text-foreground hover:underline">
                    {c.parent.name}
                  </Link>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {editable && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            )}
            {can("records.archive") && (
              <MoreMenu
                label="More options for this company"
                actions={[
                  c.archived
                    ? {
                        label: "Restore company",
                        icon: ArchiveRestore,
                        onSelect: async () => {
                          if (await attempt(() => api.post(`/records/organisations/${c.id}/restore`), `${c.name} restored.`)) refresh()
                        },
                      }
                    : {
                        label: "Archive company",
                        icon: Archive,
                        destructive: true,
                        disabled: activeBrands + activePeople + activeMembers > 0,
                        title: activeBrands + activePeople + activeMembers > 0 ? "Archive or move its brands, people and group companies first." : undefined,
                        panel: (close) => (
                          <ArchivePanel
                            what={c.name}
                            reasons={o?.lists.archive_reason ?? []}
                            close={close}
                            onConfirm={async (reasonCode, reason) => {
                              if (await attempt(() => api.post(`/records/organisations/${c.id}/archive`, { reasonCode, reason }), `${c.name} archived.`)) refresh()
                            }}
                          />
                        ),
                      },
                ]}
              />
            )}
          </div>
        </div>
      </div>

      {c.excluded && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <span className="font-medium">Excluded{c.excludedAt ? ` since ${dateLabel(c.excludedAt)}` : ""}.</span> Don't approach this company or its brands and people.
          {c.exclusionReason && <span className="text-muted-foreground"> Why: {c.exclusionReason}</span>}
        </p>
      )}
      {!c.excluded && c.parent?.excluded && (
        <p className="rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-sm text-[#93370d]">
          Its parent group, {c.parent.name}, is excluded. Check before approaching this company.
        </p>
      )}

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <div className="flex items-center justify-between gap-3">
          <TabsList variant="line">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          {tab === "details" && archivedCount > 0 && (
            <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-xs text-primary hover:underline">
              {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
            </button>
          )}
        </div>
        <TabsContent value="details" className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-4">
            <Card title="Company details">
              <dl className="text-sm">
                <Row label="Legal entity">{c.legalEntity}</Row>
                <Row label="Website">{c.domain}</Row>
                <Row label="Parent group">
                  {c.parent && (
                    <Link to={`/records/organisations/${c.parent.id}`} className="hover:underline">
                      {c.parent.name}
                    </Link>
                  )}
                </Row>
                <Row label="Head office">{countryName(c.hqCountry)}</Row>
                <Row label="LinkedIn">
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="break-all hover:underline">
                      {c.linkedinUrl}
                    </a>
                  )}
                </Row>
                <Row label="Notes">{c.notes && <span className="whitespace-pre-wrap">{c.notes}</span>}</Row>
                <Row label="Added">{dateLabel(c.createdAt)}</Row>
              </dl>
            </Card>
            {c.members.length > 0 && (
              <Card title={`Companies in this group (${c.members.filter((m) => !m.archivedAt).length})`}>
                <ul className="-my-2 divide-y">
                  {c.members
                    .filter((m) => showArchived || !m.archivedAt)
                    .map((m) => (
                      <li key={m.id}>
                        <Link to={`/records/organisations/${m.id}`} className="flex items-center gap-2 py-2.5 hover:underline">
                          <span className="font-medium">{m.name}</span>
                          {m.domain && <span className="text-xs text-muted-foreground">{m.domain}</span>}
                          {m.excluded && <Chip tone={RED}>Excluded</Chip>}
                          {m.archivedAt && <Chip tone={MUTED}>Archived</Chip>}
                        </Link>
                      </li>
                    ))}
                </ul>
              </Card>
            )}
            <Card
              title={`Brands (${activeBrands})`}
              action={
                editable && (
                  <Button size="sm" variant="outline" onClick={() => setAddingBrand(true)}>
                    <Plus /> Add brand
                  </Button>
                )
              }
            >
              {brands.length ? (
                <ul className="-my-2 divide-y">
                  {brands.map((b) => (
                    <li key={b.id}>
                      <Link to={`/records/brands/${b.id}`} className="flex items-center gap-3 py-2.5 hover:underline">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-center gap-2 font-medium">
                            {b.name} {b.archivedAt && <Chip tone={MUTED}>Archived</Chip>}
                          </span>
                          <span className="text-xs text-muted-foreground">{[b.domain, optionLabel(o, "category", b.categoryCode), optionLabel(o, "routing", b.routingCode)].filter(Boolean).join(" · ")}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No brands yet.</p>
              )}
            </Card>
          </div>

          <Card
            title={`People (${activePeople})`}
            action={
              editable && (
                <Button size="sm" variant="outline" onClick={() => setAddingPerson(true)}>
                  <Plus /> Add person
                </Button>
              )
            }
          >
            {people.error ? (
              <LoadError message={people.error} retry={people.reload} />
            ) : staff.length ? (
              <ul className="-my-2 divide-y">
                {staff.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2 font-medium">
                        {personName(p)}
                        {p.archived && <Chip tone={MUTED}>Archived</Chip>}
                        {p.buyingRoleCode && <span className="text-xs font-normal text-muted-foreground">{optionLabel(o, "buying_role", p.buyingRoleCode)}</span>}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[p.jobTitle, p.brands.filter((b) => !b.archivedAt).map((b) => b.name + (b.isPrimary ? " (main contact)" : "")).join(", ")].filter(Boolean).join(" · ")}
                      </span>
                      {p.email && (
                        <span className="flex items-center gap-1 text-xs">
                          {p.email} <EmailStatus status={p.emailStatus} />
                        </span>
                      )}
                    </div>
                    <PersonActions person={p} options={o} onChanged={refresh} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{people.loading ? "Loading…" : "No one added yet."}</p>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card title="History">{history.error ? <LoadError message={history.error} retry={history.reload} /> : history.data ? <HistoryList entries={history.data} /> : <Loading />}</Card>
          <p className="mt-2 text-xs text-muted-foreground">Changes to this company, its brands and its people. Nothing here can be edited or removed.</p>
        </TabsContent>
      </Tabs>

      <OrganisationDialog
        open={editing}
        org={c}
        options={o}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          refresh()
        }}
      />
      <BrandDialog open={addingBrand} organisationId={c.id} options={o} onClose={() => setAddingBrand(false)} onSaved={(b) => navigate(`/records/brands/${b.id}`)} />
      <PersonDialog
        open={addingPerson}
        organisationId={c.id}
        options={o}
        onClose={() => setAddingPerson(false)}
        onSaved={() => {
          setAddingPerson(false)
          refresh()
        }}
      />
    </div>
  )
}
