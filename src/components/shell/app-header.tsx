import { LogOut, Monitor, Moon, Settings, Sun } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { Logo } from "@/components/brand/logo"
import { PersonAvatar } from "@/components/common/person-avatar"
import { showToast } from "@/components/common/toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession } from "@/lib/session"
import { useThemeMode, type ThemeMode } from "@/lib/theme"
import type { Me } from "@/lib/types"

// The app's header: ATM's mark with the area's name, and the account menu.

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match the system", icon: Monitor },
]

function UserMenu({ me }: { me: Me }) {
  const navigate = useNavigate()
  const { can, signOut } = useSession()
  const [confirm, setConfirm] = useState(false)
  const [mode, setMode] = useThemeMode()
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Account" className="ml-1 rounded-full">
            <PersonAvatar name={me.name} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-3 py-2 font-normal">
            <PersonAvatar name={me.name} className="size-9" />
            <span className="flex min-w-0 flex-col">
              <span className="font-medium text-foreground">{me.name}</span>
              <span className="text-xs break-all text-muted-foreground">{me.email}</span>
            </span>
          </DropdownMenuLabel>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {me.roles.length ? (
              me.roles.map((r) => (
                <Badge key={r.id} variant="secondary" className="bg-accent text-accent-foreground">
                  {r.name}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No role yet</span>
            )}
          </div>
          <DropdownMenuSeparator />
          {can("settings.view") && (
            <DropdownMenuItem onSelect={() => navigate("/settings")}>
              <Settings />
              Settings
            </DropdownMenuItem>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Sun />
              Appearance
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={mode} onValueChange={(v) => setMode(v as ThemeMode)}>
                {THEMES.map((t) => (
                  <DropdownMenuRadioItem key={t.value} value={t.value}>
                    <t.icon />
                    {t.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of ATM?</AlertDialogTitle>
            <AlertDialogDescription>You'll sign in with your Google account again next time.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await signOut()
                } catch {
                  showToast("Signed out on this browser. The server didn't answer.", "warning")
                }
                navigate("/login", { replace: true })
              }}
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function AppHeader({ me, area, home }: { me: Me; area: string; home: string }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-6">
        <Link to={home} aria-label={`${area} home`} className="flex min-w-0 items-center rounded-md">
          <Logo area={area} />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <UserMenu me={me} />
        </div>
      </div>
    </header>
  )
}
