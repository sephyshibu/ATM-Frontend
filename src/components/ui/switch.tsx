import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Track 32x18 (sm 28x16), knob 14 (sm 12), 2px inset. On phones (compact:) the track grows
// to 36x20 / 32x18 and an invisible pad widens the tap area.
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & { size?: "sm" | "default" }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "group/switch peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full outline-none transition-[background-color,box-shadow,filter] duration-150 ease-out after:absolute after:-inset-1 after:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-[3px] aria-invalid:ring-destructive/30 motion-reduce:transition-none",
        "h-[18px] w-8 data-[size=sm]:h-4 data-[size=sm]:w-7 compact:h-5 compact:w-9 compact:data-[size=sm]:h-[18px] compact:data-[size=sm]:w-8 compact:after:-inset-2",
        "data-[state=unchecked]:bg-muted data-[state=unchecked]:shadow-[inset_0_0_0_1px_var(--input)] data-[state=unchecked]:hover:bg-input/50 dark:data-[state=unchecked]:bg-input/50 dark:data-[state=unchecked]:hover:bg-input/70",
        "data-[state=checked]:bg-primary data-[state=checked]:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14),inset_0_1px_1px_rgb(255_255_255/0.22)] data-[state=checked]:hover:brightness-95 dark:data-[state=checked]:bg-primary/85 dark:data-[state=checked]:hover:brightness-110",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-3.5 rounded-full border border-black/5 bg-white dark:bg-white shadow-xs ring-0 transition-transform duration-150 ease-out motion-reduce:transition-none dark:border-transparent",
          "translate-x-0.5 data-[state=checked]:translate-x-4 group-data-[size=sm]/switch:size-3 group-data-[size=sm]/switch:data-[state=checked]:translate-x-3.5",
          "compact:size-4 compact:data-[state=checked]:translate-x-[18px] compact:group-data-[size=sm]/switch:size-3.5 compact:group-data-[size=sm]/switch:data-[state=checked]:translate-x-4",
          "dark:data-[state=unchecked]:bg-foreground/80"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
