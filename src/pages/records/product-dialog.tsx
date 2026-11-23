import { useState } from "react"

import { Field } from "@/components/common/form"
import { SearchPick } from "@/components/common/search-pick"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { optionLabel } from "@/lib/records"
import type { Product, RecordOptions } from "@/lib/types"

import { attempt, useBusy } from "../settings/shared"
import { CustomFieldInputs, customPayload, fieldsFor, missingRequired } from "./custom-fields"
import { TagPick } from "./tags"

// Add or edit a product of a brand (Garnier → face wash). Category and sub-category are optional: left empty,
// the product takes the brand's.

type BrandRef = { id: string; name: string; categoryCode: string | null; subCategoryCode: string | null }

export function ProductDialog(props: { open: boolean; brand: BrandRef; product?: Product; options?: RecordOptions; onClose: () => void; onSaved: (products: Product[]) => void }) {
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-[600px]">{props.open && <ProductForm {...props} />}</DialogContent>
    </Dialog>
  )
}

function ProductForm({ brand, product, options, onClose, onSaved }: { brand: BrandRef; product?: Product; options?: RecordOptions; onClose: () => void; onSaved: (products: Product[]) => void }) {
  const [name, setName] = useState(product?.name ?? "")
  const [sku, setSku] = useState(product?.sku ?? "")
  const [categoryCode, setCategory] = useState(product?.categoryCode ?? "")
  const [subCategoryCode, setSub] = useState(product?.subCategoryCode ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [tagCodes, setTags] = useState(product?.tags.map((t) => t.code) ?? [])
  const [custom, setCustom] = useState<Record<string, unknown>>(product?.custom ?? {})
  const customFields = fieldsFor(options, "product", product?.custom)
  const customMissing = missingRequired(customFields, custom)
  const [tried, setTried] = useState(false)
  const [busy, run] = useBusy()

  const lists = options?.lists
  const categories = (lists?.category ?? []).filter((o) => !o.retired || o.code === product?.categoryCode).map((o) => ({ value: o.code, label: o.label }))
  const subs = (lists?.sub_category ?? []).filter((o) => o.parentCode === categoryCode && (!o.retired || o.code === product?.subCategoryCode)).map((o) => ({ value: o.code, label: o.label }))
  const brandCategory = [optionLabel(options, "category", brand.categoryCode), optionLabel(options, "sub_category", brand.subCategoryCode)].filter(Boolean).join(" › ")

  const save = async () => {
    setTried(true)
    if (!name.trim() || customMissing) return
    const body = { name: name.trim(), sku, categoryCode, subCategoryCode, description, tagCodes, custom: customPayload(customFields, custom) }
    const r = await run(() =>
      attempt(() => (product ? api.patch<Product[]>(`/records/products/${product.id}`, body) : api.post<Product[]>(`/records/brands/${brand.id}/products`, body)), product ? "Saved." : `${name.trim()} added.`),
    )
    if (r) onSaved(r)
  }

  return (
    <>
      <div className="flex flex-col gap-1 border-b px-6 py-4">
        <DialogTitle>{product ? `Edit ${product.name}` : `Add a product to ${brand.name}`}</DialogTitle>
        <DialogDescription>Only the name is needed. Leave the category empty to use the brand's{brandCategory ? ` (${brandCategory})` : ""}.</DialogDescription>
      </div>
      <div className="grid grid-cols-2 gap-3 overflow-y-auto px-6 py-5">
        <Field label="Product name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Face wash" aria-invalid={tried && !name.trim()} className="h-8 text-foreground" />
        </Field>
        <Field label="SKU or product code (optional)">
          <Input value={sku} onChange={(e) => setSku(e.target.value)} className="h-8 text-foreground" />
        </Field>
        <Field label="Category">
          <SearchPick
            options={categories}
            value={categoryCode}
            onChange={(v) => {
              setCategory(v)
              if (v !== categoryCode) setSub("")
            }}
            placeholder="Same as brand"
            aria-label="Category"
          />
        </Field>
        <Field label="Sub-category">
          <SearchPick options={subs} value={subCategoryCode} onChange={setSub} disabled={!categoryCode} placeholder={categoryCode ? "Choose" : "Same as brand"} aria-label="Sub-category" />
        </Field>
        <Field label="Tags" className="col-span-2">
          <TagPick options={options} values={tagCodes} onChange={setTags} current={product?.tags} />
        </Field>
        <CustomFieldInputs fields={customFields} values={custom} onChange={setCustom} tried={tried} />
        <Field label="Description" className="col-span-2">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-16 text-foreground" />
        </Field>
        {tried && (!name.trim() || customMissing) && <p className="col-span-2 text-xs text-destructive">{!name.trim() ? "Give the product a name." : `${customMissing!.label} is required.`}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t px-6 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {product ? "Save" : "Add product"}
        </Button>
      </div>
    </>
  )
}
