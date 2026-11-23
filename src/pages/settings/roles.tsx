import { Archive, ArchiveRestore, Copy, Eye, Info, Pencil } from "lucide-react"
import { useMemo, useState } from "react"

import { Chip } from "@/components/common/chip"
import { Field } from "@/components/common/form"
import { ListToolbar, NoMatches, useListControls } from "@/components/common/list-toolbar"
import { MoreMenu } from "@/components/common/more-menu"
import { NotePanel } from "@/components/common/panels"
import { PersonAvatar } from "@/components/common/person-avatar"
import { showToast } from "@/components/common/toast"
import { TONES } from "@/components/common/tones"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api, useApi } from "@/lib/api"
import { dateTimeLabel, plural } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { Permission, Role } from "@/lib/types"
import { cn } from "@/lib/utils"

import { attempt, LoadError, Loading, SectionCard, useBusy } from "./shared"

// Roles & permissions: what each role can do, permission by permission, and who holds it. Roles, not names,
// carry permissions. Roles are archived, never deleted; built-in roles can be changed but not archived.

/** The table's columns: role, type, permissions, held by, ⋯. */
const ROW = "grid grid-cols-[minmax(0,1.6fr)_140px_130px_140px_28px] items-center gap-3 px-4"

type Draft = { role?: Role; copyOf?: Role }

export function RolesSection() {
  const { can, refresh, me } = useSession()
  const [archived, setArchived] = useState(false)
  const roles = useApi<Role[]>(`/roles?archived=${archived}`)
  const catalogue = useApi<Permission[]>("/roles/permissions")
  const [draft, setDraft] = useState<Draft | null>(null)
  const canEdit = can("roles.manage")
  const labels = useMemo(() => new Map((catalogue.data ?? []).map((p) => [p.key, p.label])), [catalogue.data])

  const replace = (r: Role) => {
    roles.setData((cur) => (cur?.some((x) => x.id === r.id) ? cur.map((x) => (x.id === r.id ? r : x)) : [...(cur ?? []), r]))
    // Someone may have changed a role they hold themselves.
    if (me?.roles.some((x) => x.id === r.id)) void refresh()
  }

  const { shown, toolbar } = useListControls(roles.data ?? [], {
    placeholder: "Search roles and people",
    search: (r) => `${r.name} ${r.description} ${r.holders.map((h) => h.name).join(" ")}`,
    filters: [
      { id: "kind", label: "Kind", options: [{ value: "builtin", label: "Built-in" }, { value: "custom", label: "Added here" }, { value: "test", label: "Test system only" }], test: (r, v) => (v === "builtin" ? r.builtIn : v === "test" ? r.testOnly : !r.builtIn) },
      { id: "held", label: "Held", options: [{ value: "yes", label: "Someone holds it" }, { value: "no", label: "Nobody yet" }], test: (r, v) => (r.holders.length > 0) === (v === "yes") },
    ],
    sorts: [
      { value: "name", label: "Name", key: (r) => r.name },
      { value: "people", label: "People holding it", key: (r) => r.holders.length },
      { value: "perms", label: "Permissions", key: (r) => r.permissionKeys.length },
    ],
  })

  return (
    <SectionCard
      value="roles"
      title="Roles & permissions"
      description="What each role can do, and who holds it. A person can hold several roles; they add up."
      canEdit={canEdit}
      toolbar={
        <ListToolbar toolbar={toolbar}>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={archived} onCheckedChange={setArchived} aria-label="Show archived roles" />
            Show archived
          </label>
        </ListToolbar>
      }
      action={
        <Button size="sm" className="shrink-0" onClick={() => setDraft({})}>
          New role
        </Button>
      }
    >
      {roles.error ? (
        <LoadError message={roles.error} retry={roles.reload} />
      ) : roles.loading && !roles.data ? (
        <Loading />
      ) : !shown.length ? (
        <NoMatches />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className={cn(ROW, "border-b bg-muted/40 py-2 text-xs font-medium text-muted-foreground")}>
            <span>Role</span>
            <span>Type</span>
            <span>Permissions</span>
            <span>Held by</span>
            <span />
          </div>
          <ul className="divide-y">
            {shown.map((r) => (
              <li key={r.id} className={cn(ROW, "py-2.5", r.archived && "opacity-60")}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <button type="button" onClick={() => setDraft({ role: r })} className="min-w-0 cursor-pointer truncate rounded-md text-left font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    {r.name}
                  </button>
                  {r.description && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label={`About ${r.name}`} className="flex shrink-0 rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                          <Info className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-72">{r.description}</TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span>
                  {r.archived ? <Chip tone={TONES.MUTED}>Archived</Chip> : r.testOnly ? <Chip tone={TONES.AMBER}>Test system only</Chip> : r.builtIn ? <Chip tone={TONES.GREY}>Built-in</Chip> : <Chip tone={TONES.BLUE}>Added here</Chip>}
                </span>
                <span>
                  {r.permissionKeys.length ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4 outline-none">
                          {plural(r.permissionKeys.length, "permission")}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-72 whitespace-pre-line">{r.permissionKeys.map((k) => labels.get(k) ?? k).join("\n")}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </span>
                <span className="flex min-w-0 items-center gap-1">
                  {r.holders.length ? (
                    <span className="flex -space-x-1.5">
                      {r.holders.slice(0, 4).map((p) => (
                        <Tooltip key={p.id}>
                          <TooltipTrigger asChild>
                            <span className="rounded-full ring-2 ring-card">
                              <PersonAvatar name={p.name} className="size-6" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {p.name}
                            {p.status === "invited" ? " (invited)" : ""}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {r.holders.length > 4 && <span className="ml-2.5 text-xs text-muted-foreground">+{r.holders.length - 4}</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Nobody yet</span>
                  )}
                </span>
                {canEdit ? (
                  <MoreMenu
                    label={`More options for ${r.name}`}
                    actions={[
                      r.archived ? { label: "View", icon: Eye, onSelect: () => setDraft({ role: r }) } : { label: "Edit", icon: Pencil, onSelect: () => setDraft({ role: r }) },
                      !r.archived && { label: "Duplicate", icon: Copy, onSelect: () => setDraft({ copyOf: r }) },
                      r.archived
                        ? {
                            label: "Restore",
                            icon: ArchiveRestore,
                            separator: true,
                            onSelect: async () => {
                              const x = await attempt(() => api.post<Role>(`/roles/${r.id}/restore`), `${r.name} restored.`)
                              if (x) replace(x)
                            },
                          }
                        : r.builtIn || r.holders.length
                          ? { label: "Archive", icon: Archive, separator: true, disabled: true, title: r.builtIn ? "Built-in roles can't be archived." : `Take it off its ${plural(r.holders.length, "person", "people")} first.`, onSelect: () => undefined }
                          : {
                              label: "Archive",
                              icon: Archive,
                              destructive: true,
                              separator: true,
                              panel: (close) => (
                                <NotePanel
                                  title={`Archive ${r.name}?`}
                                  placeholder="Why (optional)"
                                  confirm="Archive"
                                  destructive
                                  close={close}
                                  onConfirm={async (reason) => {
                                    const x = await attempt(() => api.post<Role>(`/roles/${r.id}/archive`, { reason }), `${r.name} archived. You can restore it.`)
                                    if (x) roles.setData((cur) => (archived ? cur?.map((y) => (y.id === x.id ? x : y)) : cur?.filter((y) => y.id !== x.id)))
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
            ))}
          </ul>
        </div>
      )}

      <RoleDialog
        draft={draft}
        catalogue={catalogue.data ?? []}
        existing={roles.data ?? []}
        readOnly={!canEdit}
        onClose={() => setDraft(null)}
        onSaved={(r, isNew) => {
          setDraft(null)
          replace(r)
          showToast(isNew ? `${r.name} added.` : "Saved.")
        }}
      />
    </SectionCard>
  )
}

function RoleDialog({ draft, ...rest }: { draft: Draft | null; catalogue: Permission[]; existing: Role[]; readOnly: boolean; onClose: () => void; onSaved: (r: Role, isNew: boolean) => void }) {
  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && rest.onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-[780px]">{draft && <RoleEditor key={draft.role?.id ?? `new-${draft.copyOf?.id ?? ""}`} draft={draft} {...rest} />}</DialogContent>
    </Dialog>
  )
}

const TAB_LIST = "h-9 w-full justify-start gap-4 border-b p-0"
const TAB = "h-9 flex-none px-0 data-active:font-semibold"

function RoleEditor({ draft, catalogue, existing, readOnly: noRights, onClose, onSaved }: { draft: Draft; catalogue: Permission[]; existing: Role[]; readOnly: boolean; onClose: () => void; onSaved: (r: Role, isNew: boolean) => void }) {
  const role = draft.role
  const isNew = !role
  const readOnly = noRights || !!role?.archived
  const copyName = () => {
    if (!draft.copyOf) return ""
    const names = new Set(existing.map((x) => x.name.toLowerCase()))
    let name = `${draft.copyOf.name} copy`
    for (let n = 2; names.has(name.toLowerCase()); n++) name = `${draft.copyOf.name} copy ${n}`
    return name
  }
  const [name, setName] = useState(role?.name ?? copyName())
  const [description, setDescription] = useState(role?.description ?? draft.copyOf?.description ?? "")
  const [keys, setKeys] = useState<string[]>(role?.permissionKeys ?? draft.copyOf?.permissionKeys ?? [])
  const [tried, setTried] = useState(false)
  const [busy, run] = useBusy()

  const trimmed = name.trim()
  const taken = existing.some((r) => r.id !== role?.id && !r.archived && r.name.trim().toLowerCase() === trimmed.toLowerCase())
  const error = !trimmed ? "Give the role a name." : taken ? "Another role has this name." : undefined

  const groups = useMemo(() => {
    const out = new Map<string, Permission[]>()
    for (const p of catalogue) out.set(p.group, [...(out.get(p.group) ?? []), p])
    return [...out.entries()]
  }, [catalogue])

  const submit = async () => {
    setTried(true)
    if (error) return
    const body = { ...(role?.builtIn ? {} : { name: trimmed }), description: description.trim(), permissionKeys: keys }
    const r = await run(() => attempt(() => (isNew ? api.post<Role>("/roles", body) : api.patch<Role>(`/roles/${role.id}`, body))))
    if (r) onSaved(r, isNew)
  }

  return (
    <>
      <div className="flex flex-col gap-1 border-b px-6 py-4">
        <DialogTitle>{isNew ? (draft.copyOf ? `Duplicate ${draft.copyOf.name}` : "New role") : readOnly ? role.name : `Edit ${role.name}`}</DialogTitle>
        <DialogDescription>{role?.testOnly ? "Test system only: on the live system this role grants nothing." : "What its people can do. Changes apply the next time they load a page."}</DialogDescription>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
          <Field label={role?.builtIn ? "Name (built-in roles keep theirs)" : "Name"}>
            <Input value={name} disabled={readOnly || role?.builtIn} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing assistant" aria-invalid={tried && !!error} className="h-8 text-foreground" />
          </Field>
          <Field label="Description">
            <Textarea value={description} disabled={readOnly} rows={2} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder="One or two lines on who has it and what for." className="min-h-8 text-foreground" />
          </Field>
        </div>
        <Tabs defaultValue="permissions" className="gap-4">
          <TabsList variant="line" className={TAB_LIST}>
            <TabsTrigger value="permissions" className={TAB}>
              Permissions · {keys.length}
            </TabsTrigger>
            <TabsTrigger value="members" className={TAB}>
              Members{role ? ` · ${role.holders.length}` : ""}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="permissions" className="flex flex-col gap-4">
            {groups.map(([group, perms]) => {
              const on = perms.filter((p) => keys.includes(p.key)).length
              return (
                <section key={group} className="overflow-hidden rounded-lg border">
                  <label className={cn("flex items-center gap-3 border-b bg-muted/40 px-3 py-2", !readOnly && "cursor-pointer")}>
                    <Checkbox
                      checked={on === perms.length ? true : on ? "indeterminate" : false}
                      disabled={readOnly}
                      aria-label={`All of ${group}`}
                      onCheckedChange={(v) => setKeys((cur) => (v === true ? [...new Set([...cur, ...perms.map((p) => p.key)])] : cur.filter((k) => !perms.some((p) => p.key === k))))}
                    />
                    <span className="flex-1 text-xs font-semibold">{group}</span>
                    <span className="text-xs text-muted-foreground">
                      {on} of {perms.length}
                    </span>
                  </label>
                  <ul className="divide-y">
                    {perms.map((p) => (
                      <li key={p.key}>
                        <label className={cn("flex items-start gap-3 px-3 py-2", !readOnly && "cursor-pointer hover:bg-muted/40")}>
                          <Checkbox className="mt-0.5" checked={keys.includes(p.key)} disabled={readOnly} onCheckedChange={(v) => setKeys((cur) => (v === true ? [...cur, p.key] : cur.filter((k) => k !== p.key)))} />
                          <span className="flex min-w-0 flex-col">
                            <span className="font-medium">{p.label}</span>
                            <span className="text-xs text-muted-foreground">{p.description}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </TabsContent>
          <TabsContent value="members">
            {isNew ? (
              <p className="text-muted-foreground">Add the role, then give it to people in Users & sign-in.</p>
            ) : role.holders.length ? (
              <ul className="divide-y rounded-lg border">
                {role.holders.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <PersonAvatar name={p.name} className="size-7" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.email}</span>
                    </span>
                    {p.status === "invited" && <Badge variant="secondary">Invited</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Nobody holds this role yet. Give it to people in Users & sign-in.</p>
            )}
          </TabsContent>
        </Tabs>
        {tried && error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex items-center justify-between gap-3 border-t px-6 py-3">
        <span className="min-w-0 text-xs text-muted-foreground">{role ? `Version ${role.version} · changed ${dateTimeLabel(role.updatedAt)}` : ""}</span>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button onClick={submit} disabled={busy}>
              {isNew ? "Add role" : "Save"}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
