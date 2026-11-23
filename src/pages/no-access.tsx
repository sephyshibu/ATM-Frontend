import { Construction } from "lucide-react"

import { useSession } from "@/lib/session"

/** Signed in, but nothing built so far opens for this person's roles (only Settings exists yet). */
export function NoAccessPage() {
  const { me } = useSession()
  const roles = me?.roles ?? []
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Construction className="size-6" />
      </span>
      <h1 className="text-lg font-semibold">Nothing to open yet</h1>
      <p className="text-muted-foreground">
        {roles.length
          ? `Settings is the only area built so far, and your roles (${roles.map((r) => r.name).join(", ")}) don't open it. Records and Marketing come next.`
          : "You don't hold a role yet, so there's nothing to open. Ask an admin to give you one."}
      </p>
    </div>
  )
}
