// Search, filter and sort for every list: a search box, then Filter and Sort as icon buttons.
// useListControls() holds the state and returns the rows to show plus the toolbar's props.

import { ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowUpDown, ListFilter, Search, X } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type FilterDef<T> = { id: string; label: string; options: { value: string; label: string }[]; test: (row: T, value: string) => boolean }
export type SortDef<T> = { value: string; label: string; key: (row: T) => string | number }
type Dir = "asc" | "desc"

export function useListControls<T>(rows: T[], opts: { search: (row: T) => string; filters?: FilterDef<T>[]; sorts?: SortDef<T>[]; defaultSort?: string; defaultDir?: Dir; placeholder?: string }) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [sort, setSort] = useState(opts.defaultSort ?? "")
  const [dir, setDir] = useState<Dir>(opts.defaultDir ?? "asc")
  const filters = opts.filters ?? []
  const sorts = opts.sorts ?? []

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = rows.filter((r) => (!q || opts.search(r).toLowerCase().includes(q)) && filters.every((f) => !selected[f.id]?.length || selected[f.id].some((v) => f.test(r, v))))
    const s = sorts.find((x) => x.value === sort)
    if (s) {
      out = [...out].sort((a, b) => {
        const ka = s.key(a),
          kb = s.key(b)
        const c = typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb), undefined, { numeric: true, sensitivity: "base" })
        return dir === "asc" ? c : -c
      })
    }
    return out
    // opts' functions are recreated each render; the rows, query, filters and sort are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, selected, sort, dir])

  const toolbar: ToolbarProps = {
    query,
    onQuery: setQuery,
    placeholder: opts.placeholder,
    filters: filters.map(({ id, label, options }) => ({ id, label, options })),
    selected,
    onSelected: setSelected,
    sorts: sorts.map(({ value, label }) => ({ value, label })),
    sort,
    onSort: setSort,
    dir,
    onDir: setDir,
    shown: shown.length,
    total: rows.length,
  }
  return { shown, toolbar }
}

type ToolbarProps = {
  query: string
  onQuery: (q: string) => void
  placeholder?: string
  filters: { id: string; label: string; options: { value: string; label: string }[] }[]
  selected: Record<string, string[]>
  onSelected: (s: Record<string, string[]>) => void
  sorts: { value: string; label: string }[]
  sort: string
  onSort: (v: string) => void
  dir: Dir
  onDir: (d: Dir) => void
  shown: number
  total: number
}

/** The toolbar above a list. `children` go on the right (a list's own action). */
export function ListToolbar({ toolbar: t, children, className }: { toolbar: ToolbarProps; children?: React.ReactNode; className?: string }) {
  const active = Object.values(t.selected).reduce((n, v) => n + v.length, 0)
  const toggle = (id: string, value: string, on: boolean) => {
    const cur = t.selected[id] ?? []
    t.onSelected({ ...t.selected, [id]: on ? [...cur, value] : cur.filter((v) => v !== value) })
  }
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={t.query} onChange={(e) => t.onQuery(e.target.value)} placeholder={t.placeholder ?? "Search"} aria-label={t.placeholder ?? "Search"} className="h-8 pr-8 pl-8" />
        {t.query && (
          <button type="button" aria-label="Clear search" onClick={() => t.onQuery("")} className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {t.filters.length > 0 && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label={active ? `Filter, ${active} on` : "Filter"} className={cn("relative bg-card", active > 0 && "border-primary/40 text-primary")}>
                  <ListFilter />
                  {active > 0 && <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">{active}</span>}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Filter</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="max-h-[60vh] w-60 overflow-y-auto">
            {t.filters.map((f, i) => (
              <div key={f.id}>
                {i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{f.label}</DropdownMenuLabel>
                {f.options.map((o) => (
                  <DropdownMenuCheckboxItem key={o.value} checked={!!t.selected[f.id]?.includes(o.value)} onCheckedChange={(on) => toggle(f.id, o.value, on)} onSelect={(e) => e.preventDefault()}>
                    {o.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>
            ))}
            {active > 0 && (
              <>
                <DropdownMenuSeparator />
                <button type="button" onClick={() => t.onSelected({})} className="w-full rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-muted">
                  Clear filters
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {t.sorts.length > 0 && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="Sort" className={cn("bg-card", t.sort && "text-primary")}>
                  {!t.sort ? <ArrowUpDown /> : t.dir === "asc" ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t.sort ? `Sorted by ${t.sorts.find((s) => s.value === t.sort)?.label.toLowerCase()}` : "Sort"}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={t.sort} onValueChange={t.onSort}>
              <DropdownMenuRadioItem value="" onSelect={(e) => e.preventDefault()}>
                Default order
              </DropdownMenuRadioItem>
              {t.sorts.map((s) => (
                <DropdownMenuRadioItem key={s.value} value={s.value} onSelect={(e) => e.preventDefault()}>
                  {s.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {t.sort && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={t.dir} onValueChange={(v) => t.onDir(v as Dir)}>
                  <DropdownMenuRadioItem value="asc" onSelect={(e) => e.preventDefault()}>
                    Ascending
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="desc" onSelect={(e) => e.preventDefault()}>
                    Descending
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {children && <span className="ml-auto flex shrink-0 items-center gap-1.5">{children}</span>}
    </div>
  )
}

/** Shown in place of a list when search or filters leave nothing. */
export function NoMatches() {
  return <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">Nothing matches. Try another search or clear the filters.</p>
}
