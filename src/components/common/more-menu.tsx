// The ⋯ More options menu of list rows; an entry can open a small panel (a form or a confirmation) by the button.
// The QuoteOps menu, desktop only.

import { Ellipsis, type LucideIcon } from "lucide-react"
import { Fragment, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"

export type MenuAction = {
  label: string
  icon?: LucideIcon
  destructive?: boolean
  disabled?: boolean
  separator?: boolean
  /** Why it's disabled, on hover. */
  title?: string
} & ({ onSelect: () => void } | { panel: (close: () => void) => React.ReactNode })

export function MoreMenu({ actions, label = "More options" }: { actions: (MenuAction | false | undefined)[]; label?: string }) {
  const list = actions.filter((a): a is MenuAction => !!a)
  const [panel, setPanel] = useState<number | null>(null)
  const later = useRef<number | null>(null)
  const current = panel !== null ? list[panel] : undefined
  return (
    <span className="inline-flex" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Popover open={panel !== null} onOpenChange={(o) => !o && setPanel(null)}>
        <DropdownMenu>
          <PopoverAnchor asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label={label}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
          </PopoverAnchor>
          <DropdownMenuContent
            align="end"
            className="w-56"
            onCloseAutoFocus={(e) => {
              const c = later.current
              later.current = null
              if (c === null) return
              e.preventDefault()
              setPanel(c)
            }}
          >
            {list.map((a, i) => (
              <Fragment key={`${a.label}${i}`}>
                {a.separator && i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem variant={a.destructive ? "destructive" : "default"} disabled={a.disabled} title={a.title} onSelect={() => ("panel" in a ? (later.current = i) : a.onSelect())}>
                  {a.icon && <a.icon />}
                  {a.label}
                </DropdownMenuItem>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {current && "panel" in current && (
          <PopoverContent align="end" className="w-80 gap-2.5 p-3">
            {current.panel(() => setPanel(null))}
          </PopoverContent>
        )}
      </Popover>
    </span>
  )
}
