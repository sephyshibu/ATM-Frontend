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
  lists: Record<"category" | "sub_category" | "routing" | "tier" | "buying_role" | "consent_basis" | "archive_reason" | "tag" | "disqualify_reason" | "override_reason" | "gate_change_reason" | "fact_source_tier" | "fact_reject_reason", ListOption[]>
  countries: string[]
  owners: { id: string; name: string; email: string }[]
  /** Brand and product fields added in Settings → Fields (retired ones too). */
  fields: CustomField[]
  /** Built-in fields that are required now, by record type (Settings → Fields). */
  required?: Record<"organisation" | "brand" | "product" | "person", string[]>
}

/** A field every record has. Its Required can be switched in Settings → Fields unless it's locked. */
export type BuiltInField = { key: string; label: string; type: string; required: boolean; defaultRequired: boolean; locked: boolean; unique?: string; list?: string; help: string }

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
export type TargetChoice = { value: string; label: string; id?: string; parent?: string | null }
export type ImportTarget = {
  key: string
  label: string
  required: boolean
  hint: string
  aliases: string[]
  group: string
  /** Fields with set values: what a cell can be mapped to. */
  choices?: TargetChoice[]
  /** Where a new value can be added from the mapping step. */
  addTo?: { kind: "list"; listKey: string; parentFrom?: string } | { kind: "fact"; key: string } | { kind: "custom"; id: string } | null
  multi?: boolean
  /** Takes several columns (notes, long text): joined, one line each. */
  joinable?: boolean
}

export type ImportRowResult = { row: number; ok: boolean; action?: "new" | "update"; reasons: string[]; warnings: string[]; summary: string }

export type ImportCheck = { total: number; ready: number; rejected: number; newBrands?: number; updates?: number; newOrganisations?: number; contacts?: number; leadsOpened?: number; facts?: number; dossierLinks?: number; rows: ImportRowResult[] }

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
  brands: { id: string; name: string; domain: string | null; categoryCode: string | null; routingCode: string | null; archivedAt: string | null }[]
  people: { id: string; firstName: string; lastName: string; jobTitle: string; email: string | null; archivedAt: string | null }[]
  parent: GroupCompany | null
  members: GroupCompany[]
}

export type Brand = Audited & {
  id: string
  organisationId: string
  name: string
  domain: string | null
  categoryCode: string | null
  subCategoryCode: string | null
  routingCode: string | null
  homeCountry: string | null
  homeRevenueUsd: number | null
  /** The high end when the revenue is a range. */
  homeRevenueMaxUsd: number | null
  revenueYear: number | null
  asianMarketsLive: string[]
  tierCode: string | null
  ownerId: string | null
  source: string
  description: string
  linkedinUrl: string | null
  custom: CustomValues
  /** The knowledge base: worked out by the system from the facts. */
  kbStatus: KbStatus
  kbVerifiedAt: string | null
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
  sameDomain: { id: string; name: string; domain: string | null; archived: boolean; organisation: { name: string } }[]
  similar: { id: string; name: string; domain: string | null; organisation: { name: string } }[]
  /** Brands of other organisations in the same parent group. */
  sameGroup: { group: { id: string; name: string }; brands: { id: string; name: string; domain: string | null; organisation: { name: string } }[] } | null
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
  brand: { id: string; name: string; domain: string | null; routingCode: string | null; tierCode: string | null; kbStatus: KbStatus; organisation: { id: string; name: string; excluded: boolean } }
  person: { id: string; firstName: string; lastName: string; email: string | null; emailStatus: string } | null
  lastMove: LeadMove | null
  /** The desk gates' recommendation. */
  recommendation: Recommendation | null
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
  /** For decisions: what the gates recommend, and whether this move goes against it. */
  recommendation: (Recommendation & { stage: "desk" | "call"; override: boolean }) | null
}

export type LeadDetail = Lead & {
  person: { id: string; firstName: string; lastName: string; email: string | null; emailStatus: string; linkedinUrl: string | null; buyingRoleCode: string | null } | null
  moves: LeadMove[]
  available: AvailableMove[]
  events: { type: string; label: string; to: string }[]
  canUndo: boolean
  undoLabel: string | null
  recommendations: { desk: Recommendation; call: Recommendation }
}

export type Journey = {
  stages: { key: string; label: string }[]
  lanes: { key: string; label: string }[]
  events: { type: string; label: string }[]
  flags: Record<string, string>
}

// ---------------------------------------------------------------- Gates

export type Recommendation = { value: string; label: string; reasons: string[] }

export type GateChange = { id: string; field: string; before: string | null; after: string | null; reasonCode: string | null; reason: string | null; source: string; actorLabel: string; at: string }

export type GateRow = {
  code: string
  name: string
  checks: string
  stage: "desk" | "call"
  value: "pass" | "fail" | "unknown"
  applies: boolean
  notApplicableReason: string | null
  evidence: string
  /** Free notes on this gate for the brand. */
  note: string
  source: "default" | "auto" | "import" | "manual" | "call"
  setBy: string | null
  setAt: string | null
  ruleCheck: { value: string; why: string } | null
  disagrees: boolean
  canEdit: boolean
  needsReason: boolean
  history: GateChange[]
}

export type LeadGates = { gates: GateRow[]; desk: Recommendation; call: Recommendation }

export type GateDefinition = { code: string; name: string; checks: string; stage: "desk" | "call"; rule: string | null; active: boolean; sortOrder: number }

// ---------------------------------------------------------------- Knowledge base

export type KbStatus = "not_started" | "in_progress" | "verified" | "stale"

export type FactType = "text" | "long_text" | "number" | "usd" | "date" | "yes_no" | "choice" | "multi_choice"
export type FactValue = string | number | boolean | string[] | null

export type Dossier = {
  id: string
  kind: "file" | "link"
  title: string
  sourceUrl: string | null
  fileName: string | null
  fileType: "pdf" | "docx" | "doc" | null
  fileTypeLabel: string | null
  sizeBytes: number | null
  size: string | null
  /** uploading | queued | fetching | stored | linked (a Google link, opened with your own sign-in) | link_only | failed */
  status: "uploading" | "queued" | "fetching" | "stored" | "linked" | "link_only" | "failed"
  statusNote: string | null
  origin: "upload" | "import" | "link"
  note: string
  createdAt: string
  createdBy: string | null
  storedAt: string | null
  archivedAt: string | null
  archiveReason: string | null
  /** A Google Docs/Drive link. */
  google: boolean
  /** "Marked as checked": someone opened it and confirmed it's the right, correct dossier. */
  checked: { at: string; by: string | null; note: string; versionDate: string | null; self: boolean } | null
}

export type FactVersion = {
  id: string
  value: FactValue
  source: string
  sourceTierCode: string | null
  sourceTier: string | null
  evidenceDate: string
  refreshDue: string
  stale: boolean
  status: "entered" | "verified" | "rejected"
  origin: "manual" | "import"
  note: string
  dossier: { id: string; title: string; archived: boolean } | null
  enteredBy: string
  enteredAt: string
  /** Entered by the person looking. */
  mine: boolean
  verifiedBy: string | null
  verifiedAt: string | null
  selfVerified: boolean
  rejectedBy: string | null
  rejectedAt: string | null
  rejectReason: string | null
  supersededAt: string | null
}

export type FactField = {
  key: string
  label: string
  help: string
  type: FactType
  options: string[]
  required: boolean
  refreshDays: number
  /** From the brand's own details, when nothing is entered yet. */
  suggested: FactValue
  current: FactVersion | null
  history: FactVersion[]
}

export type KnowledgeBase = {
  status: { status: KbStatus; label: string; basis?: "required" | "entered"; required: number; verified: number; waiting: string[]; missing: string[]; stale: string[]; verifiedAt: string | null }
  groups: { code: string; label: string; fields: FactField[] }[]
  archived: boolean
  can: { enter: boolean; verify: boolean; verifyOwn: boolean; attach: boolean }
  today: string
  dossiers: Dossier[]
  storage: { configured: boolean }
  maxMb: number
}

export type FactDefinition = {
  key: string
  label: string
  groupCode: "company" | "asia" | "regulatory" | "outreach"
  help: string
  type: FactType
  options: string[]
  required: boolean
  refreshDays: number
  brandField: string | null
  active: boolean
  sortOrder: number
}

export type StorageStatus = { configured: boolean; bucket: string | null; region: string; prefix: string; encryption: string; ok: boolean; error: string | null; note: string | null }

// ---------------------------------------------------------------- Email templates (Step 8)

export type TemplateKind = "sequence" | "booking"
export type TemplateStep = { subject: string; body: string; delayDays: number }

export type TemplateSummary = {
  id: string
  kind: TemplateKind
  name: string
  description: string
  archived: boolean
  live: { version: number; approvedAt: string; approvedBy: string | null } | null
  draft: { id: string; version: number; by: string; updatedAt: string } | null
  usedIn: number
}

export type TemplateVersion = {
  id: string
  version: number
  status: "draft" | "approved" | "superseded" | "discarded"
  steps: TemplateStep[]
  openingFallback: string
  note: string
  createdAt: string
  createdBy: string
  updatedAt: string
  approvedAt: string | null
  approvedBy: string | null
  supersededAt: string | null
  discardedAt: string | null
  /** I wrote or edited it (I can still approve it: recorded as self-approved). */
  mine: boolean
  selfApproved: boolean
}

export type TemplateDetail = {
  id: string
  kind: TemplateKind
  name: string
  description: string
  archived: boolean
  usedIn: number
  versions: TemplateVersion[]
  can: { write: boolean; approve: boolean }
}

export type MergeField = { key: string; label: string; group: string; example: string; help: string }

export type TemplateRule = {
  id: string
  kind: TemplateKind
  categoryCode: string
  subCategoryCode: string
  routingCode: string
  template: { id: string; name: string; archived: boolean; liveVersion: number | null }
  updatedAt: string
}

export type RenderedStep = { step: number; name: string; delayDays: number; delayUnit?: string; subject: string; body: string }

export type BrandTemplates = {
  contact: { id: string; name: string; email: string | null; why: string | null } | null
  touchOne: "verified" | "not_verified" | "missing"
  results: { kind: TemplateKind; template: { id: string; name: string } | null; version: number | null; matchedBy: string | null; tried: string[]; steps: RenderedStep[]; warnings: string[] }[]
}

export type TemplatePreview = { contact: BrandTemplates["contact"]; touchOne: BrandTemplates["touchOne"]; steps: RenderedStep[]; missing: string[]; usedFallbackOpening: boolean; problems: string[] }

// ---------------------------------------------------------------- Booking pages and Google Calendar

export type BookingQuestionType = "text" | "textarea" | "phone" | "email" | "url" | "number" | "yesno" | "select"
export type BookingQuestion = { id: string; label: string; type: BookingQuestionType; required: boolean; options?: string[]; help?: string }
export type AvailabilityWindow = { weekday: number; startMinute: number; endMinute: number }

export type CalendarStatus = { configured: boolean; missing: string[]; callbackUrl: string; connected: { email: string | null; since: string } | null }

export type EventTypeView = {
  id: string
  name: string
  description: string
  slug: string
  link: string
  durationMins: number
  conferencing: "GOOGLE_MEET" | "CUSTOM_LINK" | "NONE"
  customLink: string | null
  bufferBeforeMins: number
  bufferAfterMins: number
  minNoticeMins: number
  dateRangeDays: number
  slotIncrementMins: number
  maxPerDay: number | null
  timezone: string
  questions: BookingQuestion[]
  availability: AvailabilityWindow[]
  active: boolean
  archived: boolean
  upcoming: number
  updatedAt: string
}

export type HostBooking = {
  id: string
  eventName: string
  inviteeName: string
  inviteeEmail: string
  inviteeTimezone: string | null
  startsAt: string
  endsAt: string
  status: "confirmed" | "cancelled"
  meetingUrl: string | null
  onCalendar: boolean
  answers: { label: string; value: string }[]
  brand: { id: string; name: string } | null
  personId: string | null
  cancelledBy: string | null
  cancelReason: string | null
  rescheduledFrom: string | null
  createdAt: string
}

export type PublicEventInfo = {
  name: string
  description: string
  durationMins: number
  conferencing: EventTypeView["conferencing"]
  timezone: string
  dateRangeDays: number
  hostName: string
  hostTitle: string
  questions: BookingQuestion[]
}

export type SlotList = { slots: string[]; timezone: string; durationMins: number }

export type ManageInfo = {
  eventName: string
  hostName: string
  durationMins: number
  timezone: string
  inviteeName: string
  inviteeTimezone: string | null
  startsAt: string
  endsAt: string
  status: "confirmed" | "cancelled"
  meetingUrl: string | null
  canChange: boolean
}
