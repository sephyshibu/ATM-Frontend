import { Check, Copy, Mail, MailX, Pencil, UserPlus, UserRoundCheck, UserRoundX } from "lucide-react"
import { useState } from "react"

import { Chip } from "@/components/common/chip"
import { Field } from "@/components/common/form"
import { ListToolbar, NoMatches, useListControls } from "@/components/common/list-toolbar"
import { MoreMenu } from "@/components/common/more-menu"
import { ConfirmPanel, NotePanel } from "@/components/common/panels"
import { PersonAvatar } from "@/components/common/person-avatar"
import { showToast } from "@/components/common/toast"
import { TONES } from "@/components/common/tones"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api, useApi } from "@/lib/api"
import { dateLabel, dateTimeLabel } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { InviteResult, Role, User } from "@/lib/types"
import { cn } from "@/lib/utils"

import { attempt, LoadError, Loading, SectionCard, useBusy } from "./shared"

// Users & sign-in: everyone who can sign in, the roles they hold, and where their invite stands. Sign-in is with
// Google only; nobody is ever deleted (deactivated people keep their name on everything they did).

const STATUS = {
  active: { tone: TONES.GREEN, label: "Active" },
  invited: { tone: TONES.BLUE, label: "Invited" },
  expired: { tone: TONES.AMBER, label: "Invite expired" },
  deactivated: { tone: TONES.MUTED, label: "Deactivated" },
}
const statusOf = (u: User) => (u.status === "invited" && u.inviteExpired ? "expired" : u.status)

/** The table's columns: person, email, roles, last sign-in, status, ⋯. */
const ROW = "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_130px_120px_28px] items-center gap-3 px-4"

export function UsersSection() {
  const { me, can, refresh } = useSession()
  const users = useApi<User[]>("/users")
  const roles = useApi<Role[]>("/roles")
  const [editing, setEditing] = useState<{ user?: User } | null>(null)
  const [link, setLink] = useState<{ name: string; email: string; url: string } | null>(null)
  const canEdit = can("users.manage")
  const list = users.data ?? []

  /** Puts a changed person in the list; refreshes the session when it's the signed-in person. */
  const replace = (u: User) => {
    users.setData((cur) => (cur?.some((x) => x.id === u.id) ? cur.map((x) => (x.id === u.id ? u : x)) : [...(cur ?? []), u]))
    if (u.id === me?.id) void refresh()
  }
  const afterInvite = (r: InviteResult | undefined, verb: string) => {
    if (!r) return
    replace(r.user)
    if (r.inviteLink) setLink({ name: r.user.name, email: r.user.email, url: r.inviteLink })
    else if (r.error) showToast(`${verb}, but the email couldn't be sent: ${r.error}`, "warning")
    else showToast(`${verb}. ${r.user.email} has the link.`)
  }

  const { shown, toolbar } = useListControls(list, {
    placeholder: "Search people, emails, roles",
    search: (u) => `${u.name} ${u.email} ${u.title} ${u.roles.map((r) => r.name).join(" ")}`,
    filters: [
      { id: "role", label: "Role", options: [{ value: "", label: "No role yet" }, ...(roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))], test: (u, v) => (v ? u.roles.some((r) => r.id === v) : !u.roles.length) },
      { id: "status", label: "Status", options: Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })), test: (u, v) => statusOf(u) === v },
    ],
    sorts: [
      { value: "name", label: "Name", key: (u) => u.name },
      { value: "last", label: "Last sign-in", key: (u) => u.lastSignInAt ?? "" },
      { value: "status", label: "Status", key: (u) => STATUS[statusOf(u)].label },
    ],
  })

  return (
    <SectionCard
      value="users"
      title="Users & sign-in"
      description="Everyone who can sign in, the roles they hold, and where their invite stands. Sign-in is with Google."
      canEdit={canEdit}
      toolbar={<ListToolbar toolbar={toolbar} />}
      action={
        <Button size="sm" className="shrink-0" onClick={() => setEditing({})}>
          <UserPlus />
          Invite someone
        </Button>
      }
    >
      {users.error ? (
        <LoadError message={users.error} retry={users.reload} />
      ) : users.loading && !users.data ? (
        <Loading />
      ) : !shown.length ? (
        <NoMatches />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className={cn(ROW, "border-b bg-muted/40 py-2 text-xs font-medium text-muted-foreground")}>
            <span>Person</span>
            <span>Email</span>
            <span>Roles</span>
            <span>Last sign-in</span>
            <span>Status</span>
            <span />
          </div>
          <ul className="divide-y">
            {shown.map((u) => {
              const self = u.id === me?.id
              const st = STATUS[statusOf(u)]
              return (
                <li key={u.id} className={cn(ROW, "py-2.5", u.status === "deactivated" && "opacity-60")}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <PersonAvatar name={u.name} className="size-8" />
                    <span className="flex min-w-0 flex-col">
                      <span className="flex flex-wrap items-center gap-1.5 font-medium">
                        {u.name}
                        {self && <span className="font-normal text-muted-foreground">(you)</span>}
                      </span>
                      {u.title && <span className="truncate text-xs text-muted-foreground">{u.title}</span>}
                    </span>
                  </span>
                  <span className="truncate text-muted-foreground" title={u.email}>
                    {u.email}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {u.roles.length ? (
                      u.roles.map((r) => (
                        <Badge key={r.id} variant="secondary" className="font-normal" title={r.testOnly ? "Grants nothing on the live system." : undefined}>
                          {r.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No role yet: opens nothing</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{u.lastSignInAt ? dateTimeLabel(u.lastSignInAt) : "Never"}</span>
                  <span className="flex flex-col items-start gap-0.5">
                    <Chip tone={st.tone}>{st.label}</Chip>
                    {u.status === "invited" && u.inviteExpiresAt && !u.inviteExpired && <span className="text-[11px] text-muted-foreground">until {dateLabel(u.inviteExpiresAt)}</span>}
                  </span>
                  {canEdit ? (
                    <MoreMenu
                      label={`More options for ${u.name}`}
                      actions={[
                        u.status !== "deactivated" && { label: "Edit details and roles", icon: Pencil, onSelect: () => setEditing({ user: u }) },
                        u.status === "invited" && {
                          label: "Send the invite again",
                          icon: Mail,
                          onSelect: async () => afterInvite(await attempt(() => api.post<InviteResult>(`/users/${u.id}/resend-invite`)), "Invite sent again"),
                        },
                        u.status === "invited" && {
                          label: "Cancel the invite",
                          icon: MailX,
                          destructive: true,
                          separator: true,
                          panel: (close) => (
                            <NotePanel
                              title={`Cancel ${u.name}'s invite?`}
                              placeholder="Why (optional)"
                              confirm="Cancel invite"
                              destructive
                              close={close}
                              onConfirm={async (reason) => {
                                const r = await attempt(() => api.post<User>(`/users/${u.id}/deactivate`, { reason }), "Invite cancelled. The link no longer works.")
                                if (r) replace(r)
                              }}
                            />
                          ),
                        },
                        u.status === "active" && {
                          label: "Deactivate",
                          icon: UserRoundX,
                          destructive: true,
                          separator: true,
                          disabled: self,
                          title: self ? "You can't deactivate yourself." : undefined,
                          panel: (close) => (
                            <NotePanel
                              title={`Deactivate ${u.name}?`}
                              placeholder="Why (kept in the change log)"
                              confirm="Deactivate"
                              destructive
                              required
                              close={close}
                              onConfirm={async (reason) => {
                                const r = await attempt(() => api.post<User>(`/users/${u.id}/deactivate`, { reason }), `${u.name} is deactivated and signed out everywhere.`)
                                if (r) replace(r)
                              }}
                            />
                          ),
                        },
                        u.status === "deactivated" && {
                          label: "Reactivate",
                          icon: UserRoundCheck,
                          panel: (close) => (
                            <ConfirmPanel
                              title={`Reactivate ${u.name}?`}
                              body={u.activatedAt ? "They can sign in again with the roles they had." : "They never signed in, so they get a fresh invite."}
                              confirm="Reactivate"
                              close={close}
                              onConfirm={async () => {
                                const r = await attempt(() => api.post<InviteResult>(`/users/${u.id}/reactivate`))
                                if (r?.inviteLink || r?.delivered !== undefined) afterInvite(r, "Reactivated and invited again")
                                else if (r) {
                                  replace(r.user)
                                  showToast(`${u.name} can sign in again.`)
                                }
                              }}
                            />
                          ),
                        },
                      ]}
                    />
                  ) : (
                    <span />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <DeactivatedNote users={list} />

      <PersonDialog
        open={!!editing}
        user={editing?.user}
        roles={(roles.data ?? []).filter((r) => !r.archived)}
        onClose={() => setEditing(null)}
        onSaved={(r, isNew) => {
          setEditing(null)
          if (isNew) afterInvite(r as InviteResult, "Invite sent")
          else {
            replace(r as User)
            showToast("Saved.")
          }
        }}
      />
      <InviteLinkDialog link={link} onClose={() => setLink(null)} />
    </SectionCard>
  )
}

function DeactivatedNote({ users }: { users: User[] }) {
  const n = users.filter((u) => u.status === "deactivated").length
  if (!n) return null
  return <p className="text-xs text-muted-foreground">Deactivated people can't sign in. They stay listed so their name remains on everything they did.</p>
}

function PersonDialog({ open, user, roles, onClose, onSaved }: { open: boolean; user?: User; roles: Role[]; onClose: () => void; onSaved: (r: InviteResult | User, isNew: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-[620px]">{open && <PersonForm key={user?.id ?? "new"} user={user} roles={roles} onClose={onClose} onSaved={onSaved} />}</DialogContent>
    </Dialog>
  )
}

function PersonForm({ user, roles, onClose, onSaved }: { user?: User; roles: Role[]; onClose: () => void; onSaved: (r: InviteResult | User, isNew: boolean) => void }) {
  const isNew = !user
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [title, setTitle] = useState(user?.title ?? "")
  const [roleIds, setRoleIds] = useState<string[]>(user?.roles.map((r) => r.id) ?? [])
  const [tried, setTried] = useState(false)
  const [busy, run] = useBusy()

  const error = !name.trim() ? "Add their name." : isNew && !/^\S+@\S+\.\S+$/.test(email.trim()) ? "Add a valid work email." : undefined

  const submit = async () => {
    setTried(true)
    if (error) return
    const r = await run(() =>
      attempt<InviteResult | User>(() =>
        isNew
          ? api.post<InviteResult>("/users/invite", { email: email.trim(), name: name.trim(), title: title.trim(), roleIds })
          : api.patch<User>(`/users/${user.id}`, { name: name.trim(), title: title.trim(), roleIds }),
      ),
    )
    if (r) onSaved(r, isNew)
  }

  return (
    <>
      <div className="flex flex-col gap-1 border-b px-6 py-4">
        <DialogTitle>{isNew ? "Invite someone" : `Edit ${user.name}`}</DialogTitle>
        <DialogDescription>{isNew ? "They get an email with a link, then sign in with the Google account for this email." : "Their details and the roles they hold. Each change is kept in the change log."}</DialogDescription>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-foreground" aria-invalid={tried && !name.trim()} autoFocus />
          </Field>
          <Field label="Job title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. BD executive" className="h-8 text-foreground" />
          </Field>
          <Field label="Work email (their Google account)" className="col-span-2">
            <Input type="email" value={email} disabled={!isNew} onChange={(e) => setEmail(e.target.value)} className="h-8 text-foreground" aria-invalid={tried && isNew && !!error && !!name.trim()} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Roles. A person can hold several; together they set what the person can open and do.</span>
          <ul className="divide-y rounded-lg border">
            {roles.map((r) => (
              <li key={r.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted/40">
                  <Checkbox className="mt-0.5" checked={roleIds.includes(r.id)} onCheckedChange={(v) => setRoleIds((ids) => (v === true ? [...ids, r.id] : ids.filter((x) => x !== r.id)))} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5 font-medium">
                      {r.name}
                      {r.testOnly && <Chip tone={TONES.AMBER}>Test system only</Chip>}
                    </span>
                    <span className="text-xs text-muted-foreground">{r.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {!roleIds.length && <p className="text-xs text-muted-foreground">No role: they can sign in but open nothing until they get one.</p>}
        </div>
        {tried && error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t px-6 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy}>
          {isNew ? "Send invite" : "Save"}
        </Button>
      </div>
    </>
  )
}

/** When emails are only logged (development), the invite link to pass on by hand. */
function InviteLinkDialog({ link, onClose }: { link: { name: string; email: string; url: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <Dialog open={!!link} onOpenChange={(o) => !o && (onClose(), setCopied(false))}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle>Invite ready for {link?.name}</DialogTitle>
        <DialogDescription>Emails are only logged on this server (MAIL_TRANSPORT=log), so nothing was sent. Pass this link to {link?.email} yourself. It's also in the server's console.</DialogDescription>
        <div className="flex items-center gap-2">
          <Input readOnly value={link?.url ?? ""} className="h-8 font-mono text-xs" onFocus={(e) => e.target.select()} />
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (!link) return
              try {
                await navigator.clipboard.writeText(link.url)
                setCopied(true)
              } catch {
                showToast("Couldn't copy. Select the link and copy it.", "warning")
              }
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => (onClose(), setCopied(false))}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
