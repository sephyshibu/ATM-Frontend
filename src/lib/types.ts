// What the backend sends back, screen by screen.

export type Me = {
  id: string
  email: string
  name: string
  title: string
  roles: { id: string; name: string; testOnly: boolean }[]
  permissions: string[]
}

export type AuthConfig = { googleConfigured: boolean; allowedDomains: string[] }

export type InviteInfo =
  | { valid: true; name: string; email: string; invitedBy: string; roles: string[]; expiresAt: string | null }
  | { valid: false; reason: "expired" | "used_or_unknown" }

export type UserStatus = "invited" | "active" | "deactivated"

export type User = {
  id: string
  email: string
  name: string
  title: string
  status: UserStatus
  roles: { id: string; name: string; testOnly: boolean }[]
  invitedAt: string | null
  invitedBy: { id: string; name: string } | null
  inviteExpiresAt: string | null
  inviteExpired: boolean
  activatedAt: string | null
  lastSignInAt: string | null
  deactivatedAt: string | null
  deactivatedBy: { id: string; name: string } | null
  deactivationReason: string | null
  googleLinked: boolean
  createdAt: string
}

/** An invite, resend or reactivation: the person, and the link when emails are only logged (development). */
export type InviteResult = { user: User; delivered?: boolean; inviteLink?: string; error?: string }

export type Permission = { key: string; group: string; label: string; description: string }

export type Role = {
  id: string
  name: string
  description: string
  builtIn: boolean
  testOnly: boolean
  version: number
  archived: boolean
  archivedAt: string | null
  updatedAt: string
  permissionKeys: string[]
  holders: { id: string; name: string; email: string; status: UserStatus }[]
}

export type ConfigItem = {
  key: string
  group: string
  label: string
  description: string
  type: "integer" | "text" | "month_day" | "time" | "boolean"
  unit: string
  min: number | null
  max: number | null
  value: string | number | boolean | null
  version: number
  changedAt: string | null
  changedBy: string | null
}

export type ConfigHistory = { version: number; value: string | number | boolean; reason: string; at: string; by: string | null }[]

export type ListValue = { id: string; code: string; label: string; description: string; parentId: string | null; sortOrder: number; retired: boolean; retiredAt: string | null; updatedAt: string }

export type PickList = { key: string; label: string; description: string; parentListKey: string | null; values: ListValue[] }

export type AuditEntry = {
  id: string
  at: string
  actorId: string | null
  actorLabel: string
  section: string
  action: string
  entityType: string | null
  entityId: string | null
  before: string | null
  after: string | null
  reason: string | null
}

export type AuditPage = { entries: AuditEntry[]; next: string | null }

// ---------------------------------------------------------------- Records

export type ListOption = { code: string; label: string; parentCode: string | null; retired: boolean }

export type RecordOptions = {
  lists: Record<"category" | "sub_category" | "routing" | "tier" | "buying_role" | "consent_basis" | "archive_reason" | "tag" | "disqualify_reason" | "override_reason", ListOption[]>
  countries: string[]
  owners: { id: string; name: string; email: string }[]
  /** Brand and product fields added in Settings → Fields (retired ones too). */
  fields: CustomField[]
}

export type FieldType = "text" | "long_text" | "number" | "date" | "yes_no" | "choice" | "multi_choice"

/** A field added in Settings → Fields. Values live in the record's `custom` by `key`. */
export type CustomField = {
  id: string
  entityType: "organisation" | "brand" | "product" | "person"
  key: string
  label: string
  type: FieldType
  options: string[]
  required: boolean
  help: string
  sortOrder: number
  retiredAt: string | null
}

export type CustomValues = Record<string, string | number | boolean | string[] | null>

/** A field a file's column can be mapped to. `custom.<key>` for fields from Settings → Fields. */
export type ImportTarget = { key: string; label: string; required: boolean; hint: string; aliases: string[]; group: string }

export type ImportRowResult = { row: number; ok: boolean; action?: "new" | "update"; reasons: string[]; warnings: string[]; summary: string }

export type ImportCheck = { total: number; ready: number; rejected: number; newBrands?: number; updates?: number; newOrganisations?: number; contacts?: number; leadsOpened?: number; rows: ImportRowResult[] }

export type ImportDone = ImportCheck & { batchId: string; imported: number }

type Audited = { createdAt: string; updatedAt: string; archivedAt: string | null; archived: boolean }

/** A tag on a record: a value of the Tags list. */
export type TagRef = { code: string; label: string }

export type Organisation = Audited & {
  id: string
  name: string
  domain: string | null
  hqCountry: string | null
  linkedinUrl: string | null
  notes: string
  parentId: string | null
  legalEntity: string | null
  excluded: boolean
  exclusionReason: string | null
  excludedAt: string | null
  parent?: { id: string; name: string } | null
  tags?: TagRef[]
  custom?: CustomValues
  brandCount?: number
  peopleCount?: number
}

type GroupCompany = { id: string; name: string; domain: string | null; excluded: boolean; archivedAt: string | null }

export type OrganisationDetail = Organisation & {
  brands: { id: string; name: string; domain: string; categoryCode: string | null; routingCode: string | null; archivedAt: string | null }[]
  people: { id: string; firstName: string; lastName: string; jobTitle: string; email: string | null; archivedAt: string | null }[]
  parent: GroupCompany | null
  members: GroupCompany[]
}

export type Brand = Audited & {
  id: string
  organisationId: string
  name: string
  domain: string
  categoryCode: string | null
  subCategoryCode: string | null
  routingCode: string | null
  homeCountry: string | null
  homeRevenueUsd: number | null
  revenueYear: number | null
  asianMarketsLive: string[]
  tierCode: string | null
  ownerId: string | null
  source: string
  description: string
  linkedinUrl: string | null
  custom: CustomValues
}

export type BrandRow = Brand & { organisation: { id: string; name: string; excluded: boolean }; owner: { id: string; name: string } | null; peopleCount: number; productCount: number; tags: TagRef[] }

/** A brand's product. Empty category and sub-category: it takes the brand's. */
export type Product = Audited & {
  id: string
  brandId: string
  name: string
  sku: string | null
  categoryCode: string | null
  subCategoryCode: string | null
  description: string
  custom: CustomValues
  source: string
  tags: TagRef[]
}

export type Person = Audited & {
  id: string
  organisationId: string
  firstName: string
  lastName: string
  jobTitle: string
  email: string | null
  emailStatus: "unknown" | "verified" | "invalid"
  phone: string | null
  linkedinUrl: string | null
  country: string | null
  buyingRoleCode: string | null
  consentCode: string | null
  notes: string
  custom?: CustomValues
}

export type PersonRow = Person & { organisation: { id: string; name: string }; brands: { id: string; name: string; archivedAt: string | null; isPrimary: boolean }[] }

export type BrandDetail = Brand & {
  organisation: Organisation
  owner: { id: string; name: string; email: string } | null
  people: (Person & { isPrimary: boolean; linkedAt: string })[]
  tags: TagRef[]
  products: Product[]
}

export type BrandCheck = {
  domain: string | null
  sameDomain: { id: string; name: string; domain: string; archived: boolean; organisation: { name: string } }[]
  similar: { id: string; name: string; domain: string; organisation: { name: string } }[]
  /** Brands of other organisations in the same parent group. */
  sameGroup: { group: { id: string; name: string }; brands: { id: string; name: string; domain: string; organisation: { name: string } }[] } | null
}

// ---------------------------------------------------------------- Leads

export type LeadMove = {
  id: string
  moveKey: string
  kind: "person" | "system" | "override" | "undo"
  label: string
  from: string | null
  to: string
  toUntil: string | null
  reasonCode: string | null
  reason: string | null
  actorLabel: string
  at: string
  undoneAt: string | null
}

export type Lead = {
  id: string
  brandId: string
  personId: string | null
  source: string
  stage: string
  lane: string | null
  laneUntil: string | null
  flags: string[]
  flagLabels: string[]
  stageChangedAt: string
  closedAt: string | null
  closed: boolean
  position: string
  createdAt: string
}

export type LeadRow = Lead & {
  brand: { id: string; name: string; domain: string; routingCode: string | null; tierCode: string | null; organisation: { id: string; name: string; excluded: boolean } }
  person: { id: string; firstName: string; lastName: string; email: string | null; emailStatus: string } | null
  lastMove: LeadMove | null
}

export type AvailableMove = {
  key: string
  label: string
  help: string
  allowed: boolean
  reasonList: string | null
  reasonRequired: boolean
  untilRequired: boolean
  ends: boolean
  to: string
  blockers: string[]
  warnings: string[]
}

export type LeadDetail = Lead & {
  person: { id: string; firstName: string; lastName: string; email: string | null; emailStatus: string; linkedinUrl: string | null; buyingRoleCode: string | null } | null
  moves: LeadMove[]
  available: AvailableMove[]
  events: { type: string; label: string; to: string }[]
  canUndo: boolean
  undoLabel: string | null
}

export type Journey = {
  stages: { key: string; label: string }[]
  lanes: { key: string; label: string }[]
  events: { type: string; label: string }[]
  flags: Record<string, string>
}
