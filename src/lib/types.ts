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
