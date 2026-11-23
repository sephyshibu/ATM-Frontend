import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

// A person's initials in a soft tint picked from their name (no photos in this prototype).

const TINTS = ["bg-[#e2e8ff] text-[#2342b1]", "bg-[#dcfae6] text-[#067647]", "bg-[#fef0c7] text-[#b54708]", "bg-[#ebe9fe] text-[#5925dc]", "bg-[#fde2e4] text-[#b42318]", "bg-[#d1fadf] text-[#107569]"]

const tintOf = (name: string) => TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length]

export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn("size-8", className)}>
      <AvatarFallback className={cn("text-[11px] font-semibold", tintOf(name))}>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
