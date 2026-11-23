import { Plus } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { Chip } from "@/components/common/chip"
import { ListToolbar, NoMatches, useListControls } from "@/components/common/list-toolbar"
import { MUTED, RED } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useApi } from "@/lib/api"
import { countryName, optionLabel, personName, usdShort } from "@/lib/records"
import { useSession } from "@/lib/session"
import type { BrandRow, Organisation, PersonRow, RecordOptions, TagRef } from "@/lib/types"

import { LoadError, Loading } from "../settings/shared"
import { BrandDialog } from "./brand-dialog"
import { OrganisationDialog } from "./organisation-dialog"
import { PersonActions } from "./person-actions"
import { PersonDialog } from "./person-dialog"
import { EmailStatus, EmptyList, Table } from "./shared"
import { TagChips } from "./tags"

// The three Records lists. Each has search, filters, sorting, a "Show archived" switch and an Add button
// (for people who can edit records). Rows open the record's page.

const BRAND_COLS = "minmax(0,2fr) minmax(0,1.4fr) minmax(0,1.4fr) 100px 110px 100px 60px minmax(0,1fr) 72px 56px"

/** One filter option per tag found in the rows. */
const tagOptions = (tags: TagRef[]) => [...new Map(tags.map((t) => [t.code, t.label])).entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))

const uniq = (values: (string | null | undefined)[]) => [...new Set(values.filter((v): v is string => !!v))]

function ArchivedSwitch({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
      <Switch checked={on} onCheckedChange={set} aria-label="Show archived" />
      Show archived
    </label>
  )
}

const archivedChip = <Chip tone={MUTED}>Archived</Chip>
const excludedChip = <Chip tone={RED}>Excluded</Chip>

// ---------------------------------------------------------------- Brands

export function BrandsList({ options }: { options?: RecordOptions }) {
  const { can } = useSession()
  const navigate = useNavigate()
  const [archived, setArchived] = useState(false)
  const [adding, setAdding] = useState(false)
  const rows = useApi<BrandRow[]>(`/records/brands${archived ? "?archived=true" : ""}`)
  const data = rows.data ?? []
  const label = (list: keyof RecordOptions["lists"], code: string | null) => optionLabel(options, list, code)
  const { shown, toolbar } = useListControls(data, {
    placeholder: "Search brands, websites, organisations",
    search: (b) => `${b.name} ${b.domain} ${b.organisation.name} ${b.tags.map((t) => t.label).join(" ")}`,
    filters: [
      { id: "category", label: "Category", options: uniq(data.map((b) => b.categoryCode)).map((c) => ({ value: c, label: label("category", c) })), test: (b, v) => b.categoryCode === v },
      { id: "routing", label: "Lane", options: uniq(data.map((b) => b.routingCode)).map((c) => ({ value: c, label: label("routing", c) })), test: (b, v) => b.routingCode === v },
      { id: "tier", label: "Tier", options: uniq(data.map((b) => b.tierCode)).map((c) => ({ value: c, label: label("tier", c) })), test: (b, v) => b.tierCode === v },
      { id: "home", label: "Home country", options: uniq(data.map((b) => b.homeCountry)).map((c) => ({ value: c, label: countryName(c) })), test: (b, v) => b.homeCountry === v },
      { id: "owner", label: "Owner", options: [...new Map(data.filter((b) => b.owner).map((b) => [b.owner!.id, b.owner!.name])).entries()].map(([value, l]) => ({ value, label: l })), test: (b, v) => b.owner?.id === v },
      { id: "tag", label: "Tags", options: tagOptions(data.flatMap((x) => x.tags ?? [])), test: (x, v) => !!x.tags?.some((t) => t.code === v) },
    ],
    sorts: [
      { value: "name", label: "Name", key: (b) => b.name },
      { value: "revenue", label: "Home revenue", key: (b) => b.homeRevenueUsd ?? -1 },
      { value: "products", label: "Products", key: (b) => b.productCount },
      { value: "added", label: "Date added", key: (b) => b.createdAt },
    ],
    defaultSort: "name",
  })

  return (
    <div className="flex flex-col gap-3">
      <ListToolbar toolbar={toolbar}>
        <ArchivedSwitch on={archived} set={setArchived} />
        {can("records.edit") && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add brand
          </Button>
        )}
      </ListToolbar>
      {rows.error ? (
        <LoadError message={rows.error} retry={rows.reload} />
      ) : rows.loading && !rows.data ? (
        <Loading />
      ) : !data.length ? (
        <EmptyList>No brands yet. {can("records.edit") ? "Add the first one." : ""}</EmptyList>
      ) : !shown.length ? (
        <NoMatches />
      ) : (
        <Table columns={BRAND_COLS} head={["Brand", "Organisation", "Category", "Lane", "Home", "Revenue", "Tier", "Owner", "Products", "People"]}>
          {shown.map((b) => (
            <li key={b.id}>
              <Link to={`/records/brands/${b.id}`} className="grid items-center gap-3 px-4 py-2.5 hover:bg-muted/40" style={{ gridTemplateColumns: BRAND_COLS }}>
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 truncate font-medium">
                    {b.name} {b.archived && archivedChip}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{b.domain}</span>
                  <TagChips tags={b.tags} className="mt-1" />
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{b.organisation.name}</span>
                  {b.organisation.excluded && excludedChip}
                </span>
                <span className="truncate">
                  {label("category", b.categoryCode)}
                  {b.subCategoryCode && <span className="text-muted-foreground"> · {label("sub_category", b.subCategoryCode)}</span>}
                </span>
                <span className="truncate">{label("routing", b.routingCode)}</span>
                <span className="truncate">{countryName(b.homeCountry)}</span>
                <span className="tabular-nums">{usdShort(b.homeRevenueUsd)}</span>
                <span>{label("tier", b.tierCode)}</span>
                <span className="truncate">{b.owner?.name}</span>
                <span className="tabular-nums">{b.productCount}</span>
                <span className="tabular-nums">{b.peopleCount}</span>
              </Link>
            </li>
          ))}
        </Table>
      )}
      <BrandDialog open={adding} options={options} onClose={() => setAdding(false)} onSaved={(b) => navigate(`/records/brands/${b.id}`)} />
    </div>
  )
}

// ---------------------------------------------------------------- Organisations

export function OrganisationsList({ options }: { options?: RecordOptions }) {
  const { can } = useSession()
  const navigate = useNavigate()
  const [archived, setArchived] = useState(false)
  const [adding, setAdding] = useState(false)
  const rows = useApi<Organisation[]>(`/records/organisations${archived ? "?archived=true" : ""}`)
  const data = rows.data ?? []
  const { shown, toolbar } = useListControls(data, {
    placeholder: "Search organisations and websites",
    search: (o) => `${o.name} ${o.domain ?? ""} ${o.legalEntity ?? ""} ${o.parent?.name ?? ""} ${(o.tags ?? []).map((t) => t.label).join(" ")}`,
    filters: [
      { id: "hq", label: "Head office", options: uniq(data.map((o) => o.hqCountry)).map((c) => ({ value: c, label: countryName(c) })), test: (o, v) => o.hqCountry === v },
      { id: "group", label: "Parent group", options: [...new Map(data.filter((o) => o.parent).map((o) => [o.parent!.id, o.parent!.name])).entries()].map(([value, l]) => ({ value, label: l })), test: (o, v) => o.parentId === v || o.id === v },
      {
        id: "excluded",
        label: "Exclusion",
        options: [
          { value: "yes", label: "Excluded" },
          { value: "no", label: "Not excluded" },
        ],
        test: (o, v) => o.excluded === (v === "yes"),
      },
      { id: "tag", label: "Tags", options: tagOptions(data.flatMap((x) => x.tags ?? [])), test: (x, v) => !!x.tags?.some((t) => t.code === v) },
    ],
    sorts: [
      { value: "name", label: "Name", key: (o) => o.name },
      { value: "brands", label: "Brands", key: (o) => o.brandCount ?? 0 },
      { value: "added", label: "Date added", key: (o) => o.createdAt },
    ],
    defaultSort: "name",
  })
  const cols = "minmax(0,2fr) minmax(0,1.3fr) minmax(0,1fr) 90px 90px"

  return (
    <div className="flex flex-col gap-3">
      <ListToolbar toolbar={toolbar}>
        <ArchivedSwitch on={archived} set={setArchived} />
        {can("records.edit") && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add organisation
          </Button>
        )}
      </ListToolbar>
      {rows.error ? (
        <LoadError message={rows.error} retry={rows.reload} />
      ) : rows.loading && !rows.data ? (
        <Loading />
      ) : !data.length ? (
        <EmptyList>No organisations yet. An organisation is added with its first brand, or here.</EmptyList>
      ) : !shown.length ? (
        <NoMatches />
      ) : (
        <Table columns={cols} head={["Organisation", "Parent group", "Head office", "Brands", "People"]}>
          {shown.map((o) => (
            <li key={o.id}>
              <Link to={`/records/organisations/${o.id}`} className="grid items-center gap-3 px-4 py-2.5 hover:bg-muted/40" style={{ gridTemplateColumns: cols }}>
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 truncate font-medium">
                    {o.name} {o.excluded && excludedChip} {o.archived && archivedChip}
                  </span>
                  {(o.legalEntity || o.domain) && <span className="truncate text-xs text-muted-foreground">{[o.legalEntity, o.domain].filter(Boolean).join(" · ")}</span>}
                  <TagChips tags={o.tags} className="mt-1" />
                </span>
                <span className="truncate">{o.parent?.name}</span>
                <span className="truncate">{countryName(o.hqCountry)}</span>
                <span className="tabular-nums">{o.brandCount ?? 0}</span>
                <span className="tabular-nums">{o.peopleCount ?? 0}</span>
              </Link>
            </li>
          ))}
        </Table>
      )}
      <OrganisationDialog open={adding} options={options} onClose={() => setAdding(false)} onSaved={(o) => navigate(`/records/organisations/${o.id}`)} />
    </div>
  )
}

// ---------------------------------------------------------------- People

export function PeopleList({ options }: { options?: RecordOptions }) {
  const { can } = useSession()
  const [archived, setArchived] = useState(false)
  const [adding, setAdding] = useState(false)
  const rows = useApi<PersonRow[]>(`/records/people${archived ? "?archived=true" : ""}`)
  const data = rows.data ?? []
  const { shown, toolbar } = useListControls(data, {
    placeholder: "Search people, emails, organisations",
    search: (p) => `${personName(p)} ${p.email ?? ""} ${p.jobTitle} ${p.organisation.name} ${p.brands.map((b) => b.name).join(" ")}`,
    filters: [
      { id: "role", label: "Buying role", options: uniq(data.map((p) => p.buyingRoleCode)).map((c) => ({ value: c, label: optionLabel(options, "buying_role", c) })), test: (p, v) => p.buyingRoleCode === v },
      {
        id: "email",
        label: "Email check",
        options: [
          { value: "verified", label: "Verified" },
          { value: "unknown", label: "Not checked" },
          { value: "invalid", label: "Bounced or invalid" },
          { value: "none", label: "No email" },
        ],
        test: (p, v) => (v === "none" ? !p.email : !!p.email && p.emailStatus === v),
      },
      { id: "country", label: "Country", options: uniq(data.map((p) => p.country)).map((c) => ({ value: c, label: countryName(c) })), test: (p, v) => p.country === v },
    ],
    sorts: [
      { value: "name", label: "Name", key: (p) => personName(p) },
      { value: "organisation", label: "Organisation", key: (p) => p.organisation.name },
      { value: "added", label: "Date added", key: (p) => p.createdAt },
    ],
    defaultSort: "name",
  })
  const cols = "minmax(0,1.6fr) minmax(0,1.2fr) minmax(0,1.3fr) minmax(0,1.6fr) 120px 110px 28px"

  return (
    <div className="flex flex-col gap-3">
      <ListToolbar toolbar={toolbar}>
        <ArchivedSwitch on={archived} set={setArchived} />
        {can("records.edit") && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add person
          </Button>
        )}
      </ListToolbar>
      {rows.error ? (
        <LoadError message={rows.error} retry={rows.reload} />
      ) : rows.loading && !rows.data ? (
        <Loading />
      ) : !data.length ? (
        <EmptyList>No people yet. Add them from a brand or an organisation, or here.</EmptyList>
      ) : !shown.length ? (
        <NoMatches />
      ) : (
        <Table columns={cols} head={["Person", "Organisation", "Brands", "Email", "Buying role", "Country", ""]}>
          {shown.map((p) => {
            const brands = p.brands.filter((b) => !b.archivedAt)
            return (
              <li key={p.id} className="grid items-center gap-3 px-4 py-2.5" style={{ gridTemplateColumns: cols }}>
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 truncate font-medium">
                    {personName(p)} {p.archived && archivedChip}
                  </span>
                  {p.jobTitle && <span className="truncate text-xs text-muted-foreground">{p.jobTitle}</span>}
                </span>
                <Link to={`/records/organisations/${p.organisation.id}`} className="truncate hover:underline">
                  {p.organisation.name}
                </Link>
                <span className="truncate">
                  {brands.map((b, i) => (
                    <span key={b.id}>
                      {i > 0 && ", "}
                      <Link to={`/records/brands/${b.id}`} className="hover:underline">
                        {b.name}
                      </Link>
                    </span>
                  ))}
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{p.email ?? <span className="text-muted-foreground">—</span>}</span>
                  {p.email && <EmailStatus status={p.emailStatus} />}
                </span>
                <span className="truncate">{optionLabel(options, "buying_role", p.buyingRoleCode)}</span>
                <span className="truncate">{countryName(p.country)}</span>
                <PersonActions person={p} options={options} onChanged={() => void rows.reload()} />
              </li>
            )
          })}
        </Table>
      )}
      <PersonDialog
        open={adding}
        options={options}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false)
          void rows.reload()
        }}
      />
    </div>
  )
}
