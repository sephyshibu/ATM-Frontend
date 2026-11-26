import { Plus, X } from "lucide-react"
import { useMemo, useState } from "react"

import { Chip } from "@/components/common/chip"
import { Field } from "@/components/common/form"
import { SearchPick } from "@/components/common/search-pick"
import { TONES } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { api, useApi } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { RecordOptions, TemplateKind, TemplateRule, TemplateSummary } from "@/lib/types"

import { attempt, Group, LoadError, Loading, SectionCard, useBusy } from "./shared"

// The template matrix: which template a brand gets by its category, sub-category and lane. The most specific
// cell wins: category + sub-category + lane → category + sub-category → category + lane → category → default.
// A cell can only point at a template with an approved version. Changing a cell keeps the old one as history.

const KIND_TITLE: Record<TemplateKind, string> = { sequence: "Outreach sequences", booking: "Booking emails" }
const ANY = "__any"

export function TemplateMatrixSection() {
  const { can } = useSession()
  const rules = useApi<TemplateRule[]>("/templates/matrix")
  const templates = useApi<TemplateSummary[]>("/templates")
  const options = useApi<RecordOptions>("/records/options")
  const [adding, setAdding] = useState<{ kind: TemplateKind; rule?: TemplateRule } | null>(null)
  const [busy, run] = useBusy()
  const canEdit = can("templates.matrix")
  const lists = options.data?.lists
  const label = (key: "category" | "sub_category" | "routing", code: string) => (code ? (lists?.[key].find((o) => o.code === code)?.label ?? code) : null)

  return (
    <SectionCard
      value="matrix"
      title="Template matrix"
      description="Which template each brand gets, by its category, sub-category and lane. The most specific match wins: category + sub-category + lane, then category + sub-category, then category + lane, then category, then the default."
      canEdit={canEdit}
      lock={false}
      readOnlyNote="You can look, but your roles don't allow editing the matrix."
    >
      {rules.error || templates.error || options.error ? (
        <LoadError message={rules.error ?? templates.error ?? options.error ?? ""} retry={() => {
            void rules.reload()
            void templates.reload()
            void options.reload()
          }} />
      ) : !rules.data || !templates.data || !lists ? (
        <Loading />
      ) : (
        (["sequence", "booking"] as TemplateKind[]).map((kind) => {
          const rows = rules.data!.filter((r) => r.kind === kind)
          const hasDefault = rows.some((r) => !r.categoryCode && !r.subCategoryCode && !r.routingCode)
          return (
            <Group
              key={kind}
              title={KIND_TITLE[kind]}
              hint={hasDefault ? "A default is set, so every brand gets a template." : "No default yet: brands that match no cell get no template. Add a default (leave category empty)."}
              action={
                canEdit && (
                  <Button size="sm" variant="outline" onClick={() => setAdding({ kind })}>
                    <Plus /> Add a cell
                  </Button>
                )
              }
            >
              {rows.length === 0 ? (
                <p className="rounded-lg border border-dashed px-4 py-3 text-muted-foreground">Nothing set yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-[1fr_1fr_0.8fr_1.4fr_auto] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
                    <span>Category</span>
                    <span>Sub-category</span>
                    <span>Lane</span>
                    <span>Template</span>
                    <span className="w-16" />
                  </div>
                  <ul className="divide-y">
                    {rows.map((r) => (
                      <li key={r.id} className="grid grid-cols-[1fr_1fr_0.8fr_1.4fr_auto] items-center gap-3 px-4 py-2">
                        <span>{label("category", r.categoryCode) ?? <Chip tone={TONES.BLUE}>Default</Chip>}</span>
                        <span className="text-muted-foreground">{label("sub_category", r.subCategoryCode) ?? "Any"}</span>
                        <span className="text-muted-foreground">{label("routing", r.routingCode) ?? "Any"}</span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <button type="button" className="text-left font-medium hover:underline disabled:no-underline" disabled={!canEdit} onClick={() => setAdding({ kind, rule: r })}>
                            {r.template.name}
                          </button>
                          {r.template.liveVersion ? <span className="text-xs text-muted-foreground">v{r.template.liveVersion}</span> : <Chip tone={TONES.AMBER}>No approved version</Chip>}
                          {r.template.archived && <Chip tone={TONES.MUTED}>Archived</Chip>}
                        </span>
                        <span className="flex w-16 justify-end">
                          {canEdit && (
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              aria-label="Remove this cell"
                              disabled={busy}
                              onClick={async () => {
                                if (await run(() => attempt(() => api.post(`/templates/matrix/${r.id}/remove`), "Cell removed. Brands fall back to the next match."))) void rules.reload()
                              }}
                            >
                              <X />
                            </Button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Group>
          )
        })
      )}
      {adding && lists && templates.data && (
        <CellDialog
          kind={adding.kind}
          rule={adding.rule}
          lists={lists}
          templates={templates.data.filter((t) => t.kind === adding.kind && !t.archived)}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null)
            void rules.reload()
            void templates.reload()
          }}
        />
      )}
    </SectionCard>
  )
}

function CellDialog({ kind, rule, lists, templates, onClose, onSaved }: { kind: TemplateKind; rule?: TemplateRule; lists: RecordOptions["lists"]; templates: TemplateSummary[]; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState(rule?.categoryCode || ANY)
  const [sub, setSub] = useState(rule?.subCategoryCode || ANY)
  const [lane, setLane] = useState(rule?.routingCode || ANY)
  const [templateId, setTemplateId] = useState(rule?.template.id ?? "")
  const [busy, run] = useBusy()
  const cats = [{ value: ANY, label: "Default (any category)" }, ...lists.category.filter((o) => !o.retired).map((o) => ({ value: o.code, label: o.label }))]
  const subs = useMemo(() => [{ value: ANY, label: "Any sub-category" }, ...lists.sub_category.filter((o) => !o.retired && o.parentCode === category).map((o) => ({ value: o.code, label: o.label }))], [lists, category])
  const lanes = [{ value: ANY, label: "Any lane" }, ...lists.routing.filter((o) => !o.retired).map((o) => ({ value: o.code, label: o.label }))]
  const usable = templates.map((t) => ({ value: t.id, label: t.name, hint: t.live ? `v${t.live.version} approved` : "no approved version yet" }))
  const isDefault = category === ANY
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-[480px]">
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <DialogTitle>{rule ? "Change a cell" : "Add a cell"}: {KIND_TITLE[kind].toLowerCase()}</DialogTitle>
          <DialogDescription>Brands with this category, sub-category and lane get this template. Leave category as Default for every other brand.</DialogDescription>
        </div>
        <div className="flex flex-col gap-3 px-6 py-5">
          <Field label="Category">
            <SearchPick options={cats} value={category} onChange={(v) => {
              setCategory(v)
              setSub(ANY)
              if (v === ANY) setLane(ANY)
            }} disabled={!!rule} aria-label="Category" />
          </Field>
          <Field label="Sub-category">
            <SearchPick options={subs} value={sub} onChange={setSub} disabled={!!rule || isDefault} aria-label="Sub-category" />
          </Field>
          <Field label="Lane">
            <SearchPick options={lanes} value={lane} onChange={setLane} disabled={!!rule || isDefault} aria-label="Lane" />
          </Field>
          <Field label="Template">
            <SearchPick options={usable} value={templateId} onChange={setTemplateId} placeholder={usable.length ? "Pick a template" : "No templates yet: add one in Email templates"} aria-label="Template" />
          </Field>
          <p className="text-xs text-muted-foreground">Only a template with an approved version can be used.</p>
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !templateId}
            onClick={async () => {
              const body = { kind, categoryCode: category === ANY ? "" : category, subCategoryCode: sub === ANY ? "" : sub, routingCode: lane === ANY ? "" : lane, templateId }
              if (await run(() => attempt(() => api.put("/templates/matrix", body), "Matrix saved."))) onSaved()
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
