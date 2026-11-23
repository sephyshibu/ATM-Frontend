import { Tag } from "lucide-react"
import { useState } from "react"

import { MultiPick } from "@/components/common/search-pick"
import { api } from "@/lib/api"
import type { RecordOptions, TagRef } from "@/lib/types"

import { attempt } from "../settings/shared"

// Tags: free labels from Settings → Lists → Tags, on organisations, brands and products. The picker can add a
// new tag on the spot; renaming and retiring happen in Settings.

/** Pick tags by code; typing a name that isn't there offers to add it to the Tags list. */
export function TagPick({ options, values, onChange, current = [] }: { options?: RecordOptions; values: string[]; onChange: (codes: string[]) => void; current?: TagRef[] }) {
  const [added, setAdded] = useState<TagRef[]>([])
  const list = options?.lists.tag ?? []
  // Retired tags only show when the record already has them; tags just added here show straight away.
  const choices = [
    ...list.filter((t) => !t.retired || values.includes(t.code)).map((t) => ({ value: t.code, label: t.label + (t.retired ? " (retired)" : "") })),
    ...[...added, ...current].filter((t) => !list.some((x) => x.code === t.code)).map((t) => ({ value: t.code, label: t.label })),
  ].filter((o, i, all) => all.findIndex((x) => x.value === o.value) === i)
  return (
    <MultiPick
      options={choices}
      values={values}
      onChange={onChange}
      placeholder="No tags"
      aria-label="Tags"
      createLabel={(t) => `Add the new tag "${t}"`}
      onCreate={async (label) => {
        const tag = await attempt(() => api.post<TagRef>("/records/tags", { label }))
        if (!tag) return
        setAdded((a) => [...a, tag])
        if (!values.includes(tag.code)) onChange([...values, tag.code])
      }}
    />
  )
}

/** A record's tags as small grey labels. */
export function TagChips({ tags, className = "" }: { tags?: TagRef[]; className?: string }) {
  if (!tags?.length) return null
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((t) => (
        <span key={t.code} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-px text-[11px] leading-[14px] text-muted-foreground">
          <Tag className="size-2.5" />
          {t.label}
        </span>
      ))}
    </span>
  )
}
