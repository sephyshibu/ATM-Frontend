import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, Pencil, Plus, Star, UserPlus } from "lucide-react"
import { useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"

import { Chip } from "@/components/common/chip"
import { MoreMenu } from "@/components/common/more-menu"
import { SearchPick } from "@/components/common/search-pick"
import { AMBER, BLUE, MUTED, RED, VIOLET } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, useApi } from "@/lib/api"
import { dateLabel, numberLabel } from "@/lib/format"
import { countryName, optionLabel, personName, siteUrl, useRecordOptions } from "@/lib/records"
import { useSession } from "@/lib/session"
import type { AuditEntry, BrandDetail, PersonRow } from "@/lib/types"

import { attempt, LoadError, Loading } from "../settings/shared"
import { BrandDialog } from "./brand-dialog"
import { PersonActions } from "./person-actions"
import { PersonDialog } from "./person-dialog"
import { ArchivePanel, Card, EmailStatus, HistoryList, Row } from "./shared"

// One brand: its details, the people at the company who work on it (one can be the main contact), and its history.

export function BrandPage() {
  const { id = "" } = useParams()
  const { can } = useSession()
  const options = useRecordOptions()
  const brand = useApi<BrandDetail>(`/records/brands/${id}`)
  const [tab, setTab] = useState("details")
  const history = useApi<AuditEntry[]>(tab === "history" ? `/records/brands/${id}/history` : null)
  const [editing, setEditing] = useState(false)
  const [addingPerson, setAddingPerson] = useState(false)

  if (!can("records.view")) return <Navigate to="/no-access" replace />
  if (brand.error) return <LoadError message={brand.error} retry={brand.reload} />
  if (!brand.data) return <Loading />

  const b = brand.data
  const o = options.data
  const label = (list: Parameters<typeof optionLabel>[1], code: string | null) => optionLabel(o, list, code)
  const refresh = () => {
    void brand.reload()
    if (tab === "history") void history.reload()
  }
  const editable = can("records.edit") && !b.archived

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link to="/records?tab=brands" className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Brands
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-[-0.01em]">
              {b.name}
              {b.organisation.excluded && <Chip tone={RED}>Company excluded</Chip>}
              {b.archived && <Chip tone={MUTED}>Archived</Chip>}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <a href={siteUrl(b.domain)} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                {b.domain} <ExternalLink className="size-3" />
              </a>
              <span>·</span>
              <Link to={`/records/organisations/${b.organisation.id}`} className="hover:text-foreground hover:underline">
                {b.organisation.name}
              </Link>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {b.categoryCode && <Chip tone={BLUE}>{label("category", b.categoryCode)}</Chip>}
              {b.subCategoryCode && <Chip tone={BLUE}>{label("sub_category", b.subCategoryCode)}</Chip>}
              {b.routingCode && <Chip tone={VIOLET}>Lane: {label("routing", b.routingCode)}</Chip>}
              {b.tierCode && <Chip tone={AMBER}>{label("tier", b.tierCode)}</Chip>}
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
                label="More options for this brand"
                actions={[
                  b.archived
                    ? {
                        label: "Restore brand",
                        icon: ArchiveRestore,
                        onSelect: async () => {
                          if (await attempt(() => api.post(`/records/brands/${b.id}/restore`), `${b.name} restored.`)) refresh()
                        },
                      }
                    : {
                        label: "Archive brand",
                        icon: Archive,
                        destructive: true,
                        panel: (close) => (
                          <ArchivePanel
                            what={b.name}
                            reasons={o?.lists.archive_reason ?? []}
                            close={close}
                            onConfirm={async (reasonCode, reason) => {
                              if (await attempt(() => api.post(`/records/brands/${b.id}/archive`, { reasonCode, reason }), `${b.name} archived.`)) refresh()
                            }}
                          />
                        ),
                      },
                ]}
              />
            )}
          </div>
        </div>
        {b.organisation.excluded && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <span className="font-medium">{b.organisation.name} is excluded.</span> Don't approach this brand or its people.
            {b.organisation.exclusionReason && <span className="text-muted-foreground"> Why: {b.organisation.exclusionReason}</span>}
          </p>
        )}
        {b.archived && <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">This brand is archived{b.archivedAt ? ` since ${dateLabel(b.archivedAt)}` : ""}. Nothing was deleted; restore it to work on it again.</p>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Card title="Brand details">
            <dl className="text-sm">
              <Row label="Company">
                <Link to={`/records/organisations/${b.organisation.id}`} className="hover:underline">
                  {b.organisation.name}
                </Link>
              </Row>
              <Row label="Parent group">
                {b.organisation.parent && (
                  <Link to={`/records/organisations/${b.organisation.parent.id}`} className="hover:underline">
                    {b.organisation.parent.name}
                  </Link>
                )}
              </Row>
              <Row label="Home country">{countryName(b.homeCountry)}</Row>
              <Row label="Home revenue">{b.homeRevenueUsd != null ? `USD ${numberLabel(b.homeRevenueUsd)}${b.revenueYear ? ` (${b.revenueYear})` : ""}` : null}</Row>
              <Row label="Asian markets live">{b.asianMarketsLive.map(countryName).join(", ")}</Row>
              <Row label="Owner at ATM">{b.owner?.name}</Row>
              <Row label="LinkedIn">
                {b.linkedinUrl && (
                  <a href={b.linkedinUrl} target="_blank" rel="noreferrer" className="break-all hover:underline">
                    {b.linkedinUrl}
                  </a>
                )}
              </Row>
              <Row label="About">{b.description && <span className="whitespace-pre-wrap">{b.description}</span>}</Row>
              <Row label="Added">{`${dateLabel(b.createdAt)} · ${b.source === "manual" ? "by hand" : b.source}`}</Row>
            </dl>
          </Card>

          <Card
            title={`People (${b.people.length})`}
            action={
              editable && (
                <div className="flex gap-1.5">
                  <LinkExisting brand={b} onLinked={refresh} />
                  <Button size="sm" variant="outline" onClick={() => setAddingPerson(true)}>
                    <Plus /> New person
                  </Button>
                </div>
              )
            }
          >
            {b.people.length ? (
              <ul className="-my-2 divide-y">
                {b.people.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2 font-medium">
                        {personName(p)}
                        {p.isPrimary && (
                          <Chip tone={AMBER}>
                            <Star className="size-3" /> Main contact
                          </Chip>
                        )}
                        {p.buyingRoleCode && <span className="text-xs font-normal text-muted-foreground">{label("buying_role", p.buyingRoleCode)}</span>}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{[p.jobTitle, countryName(p.country)].filter(Boolean).join(" · ")}</span>
                      {p.email && (
                        <span className="flex items-center gap-1 text-xs">
                          {p.email} <EmailStatus status={p.emailStatus} />
                        </span>
                      )}
                    </div>
                    <PersonActions person={p} options={o} onChanged={refresh} brand={b.archived ? undefined : { id: b.id, name: b.name, isPrimary: p.isPrimary }} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No one linked yet. Link someone from {b.organisation.name}, or add a new person.</p>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card title="History">{history.error ? <LoadError message={history.error} retry={history.reload} /> : history.data ? <HistoryList entries={history.data} /> : <Loading />}</Card>
          <p className="mt-2 text-xs text-muted-foreground">Changes to this brand, its company and its people. Nothing here can be edited or removed.</p>
        </TabsContent>
      </Tabs>

      <BrandDialog
        open={editing}
        brand={b}
        options={o}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          refresh()
        }}
      />
      <PersonDialog
        open={addingPerson}
        organisationId={b.organisationId}
        brandId={b.id}
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

/** Link someone who already works at the brand's company. */
function LinkExisting({ brand, onLinked }: { brand: BrandDetail; onLinked: () => void }) {
  const [open, setOpen] = useState(false)
  const people = useApi<PersonRow[]>(open ? `/records/people?organisationId=${brand.organisationId}` : null)
  const linked = new Set(brand.people.map((p) => p.id))
  const choices = (people.data ?? []).filter((p) => !linked.has(p.id)).map((p) => ({ value: p.id, label: personName(p), hint: p.jobTitle || p.email || undefined }))
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus /> Link person
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-2 p-3">
        <p className="text-xs text-muted-foreground">People at {brand.organisation.name} not yet on {brand.name}.</p>
        {people.loading ? (
          <p className="text-xs">Loading…</p>
        ) : choices.length ? (
          <SearchPick
            options={choices}
            value=""
            placeholder="Pick a person"
            aria-label="Person to link"
            onChange={async (personId) => {
              if (await attempt(() => api.post(`/records/brands/${brand.id}/people`, { personId }), "Linked.")) {
                setOpen(false)
                onLinked()
              }
            }}
          />
        ) : (
          <p className="text-xs">Everyone at the company is already linked. Add a new person instead.</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
