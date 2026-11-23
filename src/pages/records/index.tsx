import { Navigate, useSearchParams } from "react-router-dom"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRecordOptions } from "@/lib/records"
import { useSession } from "@/lib/session"

import { BrandsList, OrganisationsList, PeopleList } from "./lists"

// Records: the brands ATM may work with, the companies behind them and the people there. ?tab=… opens a list.

const TABS = [
  { key: "brands", title: "Brands", List: BrandsList },
  { key: "companies", title: "Companies", List: OrganisationsList },
  { key: "people", title: "People", List: PeopleList },
]

export function RecordsPage() {
  const { can } = useSession()
  const [params, setParams] = useSearchParams()
  const options = useRecordOptions()
  if (!can("records.view")) return <Navigate to="/no-access" replace />
  const current = TABS.find((t) => t.key === params.get("tab"))?.key ?? "brands"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Records</h1>
        <p className="text-sm text-muted-foreground">Brands, the companies behind them and the people there. Nothing is ever deleted: archived records can be restored.</p>
      </div>
      <Tabs value={current} onValueChange={(tab) => setParams({ tab }, { replace: true })} className="gap-4">
        <TabsList variant="line">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ key, List }) => (
          <TabsContent key={key} value={key}>
            {key === current && <List options={options.data} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
