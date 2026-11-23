import { Check, ChevronDown, Search, X } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// A dropdown with a search box, for long lists (countries, companies, people). One value, or several.

export type PickOption = { value: string; label: string; hint?: string }

type Common = {
  options: PickOption[]
  placeholder?: string
  /** Shown as the first row when nothing matches the search, e.g. "Add a new company". */
  onCreate?: (typed: string) => void
  createLabel?: (typed: string) => string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

function OptionList({ options, query, selected, onPick, onCreate, createLabel }: { options: PickOption[]; query: string; selected: Set<string>; onPick: (v: string) => void; onCreate?: (t: string) => void; createLabel?: (t: string) => string }) {
  const q = query.trim().toLowerCase()
  const shown = useMemo(() => (q ? options.filter((o) => `${o.label} ${o.hint ?? ""} ${o.value}`.toLowerCase().includes(q)) : options).slice(0, 200), [options, q])
  return (
    <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
      {onCreate && q && !options.some((o) => o.label.toLowerCase() === q) && (
        <li>
          <button type="button" onClick={() => onCreate(query.trim())} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-medium text-primary hover:bg-muted/60">
            {createLabel ? createLabel(query.trim()) : `Add "${query.trim()}"`}
          </button>
        </li>
      )}
      {shown.map((o) => (
        <li key={o.value}>
          <button type="button" role="option" aria-selected={selected.has(o.value)} onClick={() => onPick(o.value)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/60">
            <Check className={cn("size-3.5 shrink-0 text-primary", !selected.has(o.value) && "invisible")} />
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.hint && <span className="shrink-0 truncate text-xs text-muted-foreground">{o.hint}</span>}
          </button>
        </li>
      ))}
      {!shown.length && !(onCreate && q) && <li className="px-2.5 py-2 text-muted-foreground">Nothing matches.</li>}
    </ul>
  )
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative border-b p-1.5">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search" className="h-7 border-0 pl-7 shadow-none focus-visible:ring-0" />
    </div>
  )
}

/** One value. `value` "" = none; clearable unless `required`. */
export function SearchPick({ value, onChange, required, ...p }: Common & { value: string; onChange: (v: string) => void; required?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const current = p.options.find((o) => o.value === value)
  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o || setQuery(""))}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={p.disabled} aria-label={p["aria-label"]} className={cn("h-8 w-full justify-between bg-card px-2.5 font-normal", !current && "text-muted-foreground", p.className)}>
          <span className="truncate">{current ? current.label : (p.placeholder ?? "Choose")}</span>
          <span className="flex shrink-0 items-center gap-1">
            {current && !required && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange("")
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronDown className="size-4 opacity-60" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <SearchBox value={query} onChange={setQuery} />
        <OptionList
          options={p.options}
          query={query}
          selected={new Set(value ? [value] : [])}
          onPick={(v) => {
            onChange(v)
            setOpen(false)
            setQuery("")
          }}
          onCreate={
            p.onCreate &&
            ((t) => {
              p.onCreate!(t)
              setOpen(false)
              setQuery("")
            })
          }
          createLabel={p.createLabel}
        />
      </PopoverContent>
    </Popover>
  )
}

/** Several values, shown as a comma list on the button. */
export function MultiPick({ values, onChange, ...p }: Common & { values: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = useState("")
  const labels = useRef(new Map<string, string>())
  p.options.forEach((o) => labels.current.set(o.value, o.label))
  const text = values.map((v) => labels.current.get(v) ?? v).join(", ")
  return (
    <Popover onOpenChange={(o) => o || setQuery("")}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={p.disabled} aria-label={p["aria-label"]} className={cn("h-8 w-full justify-between bg-card px-2.5 font-normal", !values.length && "text-muted-foreground", p.className)}>
          <span className="truncate">{values.length ? text : (p.placeholder ?? "Choose")}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <SearchBox value={query} onChange={setQuery} />
        <OptionList options={p.options} query={query} selected={new Set(values)} onPick={(v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])} />
        {values.length > 0 && (
          <div className="border-t p-1.5">
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
              Clear all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
