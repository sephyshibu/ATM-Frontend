import { Archive, ArchiveRestore, FileSpreadsheet, Pencil, Plus } from "lucide-react"
import { useState } from "react"

import { Chip } from "@/components/common/chip"
import { MoreMenu } from "@/components/common/more-menu"
import { MUTED } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { optionLabel } from "@/lib/records"
import { useSession } from "@/lib/session"
import type { BrandDetail, Product, RecordOptions } from "@/lib/types"

import { attempt } from "../settings/shared"
import { fieldsFor, showValue } from "./custom-fields"
import { ImportWizard } from "./import-wizard"
import { ProductDialog } from "./product-dialog"
import { ArchivePanel, Card } from "./shared"
import { TagChips } from "./tags"

// A brand's products: organisation › brand › products. Each can be edited, tagged, archived and restored.

export function ProductsCard({ brand, options, onChanged }: { brand: BrandDetail; options?: RecordOptions; onChanged: () => void }) {
  const { can } = useSession()
  const [editing, setEditing] = useState<Product | "new" | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [importing, setImporting] = useState(false)
  const fields = fieldsFor(options, "product")
  const editable = can("records.edit") && !brand.archived
  const active = brand.products.filter((p) => !p.archived)
  const shown = showArchived ? brand.products : active
  const archivedCount = brand.products.length - active.length
  const categoryOf = (p: Product) =>
    p.categoryCode ? [optionLabel(options, "category", p.categoryCode), optionLabel(options, "sub_category", p.subCategoryCode)].filter(Boolean).join(" › ") : "Same category as the brand"

  return (
    <Card
      title={`Products (${active.length})`}
      action={
        <div className="flex items-center gap-2">
          {archivedCount > 0 && (
            <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-xs text-primary hover:underline">
              {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
            </button>
          )}
          {can("kb.import") && !brand.archived && (
            <Button size="sm" variant="outline" onClick={() => setImporting(true)}>
              <FileSpreadsheet /> Import
            </Button>
          )}
          {editable && (
            <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
              <Plus /> Add product
            </Button>
          )}
        </div>
      }
    >
      {shown.length ? (
        <ul className="-my-2 divide-y">
          {shown.map((p) => (
            <li key={p.id} className="flex items-start gap-3 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {p.name}
                  {p.sku && <span className="text-xs font-normal text-muted-foreground">{p.sku}</span>}
                  {p.archived && <Chip tone={MUTED}>Archived</Chip>}
                </span>
                <span className="text-xs text-muted-foreground">{categoryOf(p)}</span>
                {fields.some((f) => showValue(p.custom?.[f.key])) && (
                  <span className="text-xs text-muted-foreground">
                    {fields
                      .filter((f) => showValue(p.custom?.[f.key]))
                      .slice(0, 4)
                      .map((f) => `${f.label}: ${showValue(p.custom[f.key])}`)
                      .join(" · ")}
                  </span>
                )}
                <TagChips tags={p.tags} className="mt-0.5" />
              </div>
              {(editable || (can("records.archive") && !brand.archived)) && (
              <MoreMenu
                label={`More options for ${p.name}`}
                actions={[
                  editable && !p.archived && { label: "Edit", icon: Pencil, onSelect: () => setEditing(p) },
                  can("records.archive") &&
                    !brand.archived &&
                    (p.archived
                      ? {
                          label: "Restore",
                          icon: ArchiveRestore,
                          onSelect: async () => {
                            if (await attempt(() => api.post(`/records/products/${p.id}/restore`), `${p.name} restored.`)) onChanged()
                          },
                        }
                      : {
                          label: "Archive",
                          icon: Archive,
                          destructive: true,
                          separator: true,
                          panel: (close) => (
                            <ArchivePanel
                              what={p.name}
                              reasons={options?.lists.archive_reason ?? []}
                              close={close}
                              onConfirm={async (reasonCode, reason) => {
                                if (await attempt(() => api.post(`/records/products/${p.id}/archive`, { reasonCode, reason }), `${p.name} archived.`)) onChanged()
                              }}
                            />
                          ),
                        }),
                ]}
              />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No products yet.{editable ? " Add what the brand sells, e.g. face wash, body wash, or import a list from Excel." : ""}</p>
      )}
      <ImportWizard open={importing} kind="products" brand={brand} onClose={() => setImporting(false)} onImported={onChanged} />
      <ProductDialog
        open={editing !== null}
        brand={brand}
        product={editing === "new" || editing === null ? undefined : editing}
        options={options}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          onChanged()
        }}
      />
    </Card>
  )
}
