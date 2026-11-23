import { Archive, ArchiveRestore, Pencil, Star, Unlink } from "lucide-react"
import { useState } from "react"

import { MoreMenu, type MenuAction } from "@/components/common/more-menu"
import { api } from "@/lib/api"
import { personName } from "@/lib/records"
import { useSession } from "@/lib/session"
import type { Person, RecordOptions } from "@/lib/types"

import { attempt } from "../settings/shared"
import { PersonDialog } from "./person-dialog"
import { ArchivePanel } from "./shared"

// The ⋯ menu on a person's row: edit, archive or restore, and on a brand page make main contact or unlink.
// Archiving a person keeps their brand links as history; unlinking keeps the old link too.

export function PersonActions({
  person,
  options,
  onChanged,
  brand,
}: {
  person: Person & { archived?: boolean }
  options?: RecordOptions
  onChanged: () => void
  brand?: { id: string; name: string; isPrimary: boolean }
}) {
  const { can } = useSession()
  const [editing, setEditing] = useState(false)
  const name = personName(person)
  const archived = person.archived ?? !!person.archivedAt
  const edit = can("records.edit")
  const actions: (MenuAction | false)[] = [
    edit && !archived && { label: "Edit details", icon: Pencil, onSelect: () => setEditing(true) },
    edit &&
      !!brand &&
      !brand.isPrimary && {
        label: "Make main contact",
        icon: Star,
        onSelect: async () => {
          if (await attempt(() => api.post(`/records/brands/${brand.id}/people`, { personId: person.id, isPrimary: true }), `${name} is now the main contact.`)) onChanged()
        },
      },
    edit &&
      !!brand && {
        label: `Unlink from ${brand.name}`,
        icon: Unlink,
        separator: true,
        onSelect: async () => {
          if (await attempt(() => api.post(`/records/brands/${brand.id}/people/${person.id}/unlink`), `${name} unlinked. The link stays in history.`)) onChanged()
        },
      },
    can("records.archive") &&
      (archived
        ? {
            label: "Restore",
            icon: ArchiveRestore,
            separator: true,
            onSelect: async () => {
              if (await attempt(() => api.post(`/records/people/${person.id}/restore`), `${name} restored.`)) onChanged()
            },
          }
        : {
            label: "Archive",
            icon: Archive,
            destructive: true,
            separator: true,
            panel: (close) => (
              <ArchivePanel
                what={name}
                reasons={options?.lists.archive_reason ?? []}
                note="They disappear from lists and outreach; their history and brand links are kept. You can restore them any time."
                close={close}
                onConfirm={async (reasonCode, reason) => {
                  if (await attempt(() => api.post(`/records/people/${person.id}/archive`, { reasonCode, reason }), `${name} archived.`)) onChanged()
                }}
              />
            ),
          }),
  ]
  if (!actions.some(Boolean)) return null
  return (
    <>
      <MoreMenu actions={actions} label={`More options for ${name}`} />
      <PersonDialog
        open={editing}
        person={person}
        options={options}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          onChanged()
        }}
      />
    </>
  )
}
