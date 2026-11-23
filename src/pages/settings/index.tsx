import { Navigate, useSearchParams } from "react-router-dom"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/lib/session"

import { ChangeLogSection } from "./change-log"
import { ConfigSection } from "./config"
import { ListsSection } from "./lists"
import { RolesSection } from "./roles"
import { UsersSection } from "./users"

// Settings: one tab per section down the left; ?section=… opens one. Anyone with "View Settings" can look;
// changes need the matching permission (users, roles, or configuration and lists). The change log needs its own.

const SECTIONS = [
  { key: "users", title: "Users & sign-in", Section: UsersSection },
  { key: "roles", title: "Roles & permissions", Section: RolesSection },
  { key: "config", title: "Configuration", Section: ConfigSection },
  { key: "lists", title: "Lists", Section: ListsSection },
  { key: "log", title: "Change log", Section: ChangeLogSection, permission: "audit.view" },
]

export function SettingsPage() {
  const { can } = useSession()
  const [params, setParams] = useSearchParams()
  if (!can("settings.view")) return <Navigate to="/no-access" replace />
  const shown = SECTIONS.filter((s) => !s.permission || can(s.permission))
  const asked = params.get("section")
  const current = shown.find((s) => s.key === asked)?.key ?? shown[0].key

  return (
    <Tabs
      orientation="vertical"
      value={current}
      onValueChange={(key) =>
        setParams(
          (p) => {
            const next = new URLSearchParams(p)
            next.set("section", key)
            return next
          },
          { replace: true },
        )
      }
      className="w-full items-start gap-6"
    >
      <div className="sticky top-20 flex w-56 shrink-0 flex-col gap-3">
        <div className="flex flex-col gap-0.5 px-3">
          <h1 className="text-base font-semibold tracking-[-0.01em]">Settings</h1>
        </div>
        <TabsList variant="line" aria-label="Settings sections" className="w-full items-stretch gap-0.5 p-0">
          {shown.map((s) => (
            <TabsTrigger
              key={s.key}
              value={s.key}
              className="h-9 w-full flex-none justify-between rounded-md px-3 text-sm hover:bg-muted/60 after:hidden data-active:bg-primary/10! data-active:font-semibold data-active:text-primary! dark:data-active:bg-primary/15! dark:data-active:text-brand-700!"
            >
              <span className="truncate">{s.title}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className="min-w-0 flex-1">
        {/* Only the open section is mounted, so each loads its data when opened. */}
        {shown.map(({ key, Section }) => (key === current ? <Section key={key} /> : null))}
      </div>
    </Tabs>
  )
}
