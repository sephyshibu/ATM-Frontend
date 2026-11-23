// Small form pieces: a label above a control, and a whole-number input.

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** A label above a control. */
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs text-muted-foreground", className)}>
      {label}
      {children}
    </label>
  )
}

/** A small whole-number input that commits on blur or Enter. */
export function QtyInput({ value, onCommit, min = 0, className, label }: { value: number; onCommit: (n: number) => void; min?: number; className?: string; label: string }) {
  return (
    <Input
      key={value}
      type="number"
      min={min}
      step={1}
      defaultValue={value}
      aria-label={label}
      onBlur={(e) => {
        const n = Math.max(min, Math.round(Number(e.target.value)))
        if (Number.isFinite(n) && n !== value) onCommit(n)
        else e.target.value = String(value)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
      }}
      className={cn("h-7 w-16 px-2 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", className)}
    />
  )
}
