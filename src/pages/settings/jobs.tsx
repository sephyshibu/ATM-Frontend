import { FlaskConical, Play, RotateCcw } from "lucide-react"

import { Chip } from "@/components/common/chip"
import { TONES, type Tone } from "@/components/common/tones"
import { Button } from "@/components/ui/button"
import { api, useApi } from "@/lib/api"
import { dateTimeLabel } from "@/lib/format"
import { useSession } from "@/lib/session"
import { cn } from "@/lib/utils"

import { attempt, Group, LoadError, Loading, SectionCard } from "./shared"

// Jobs: what runs in the background. The schedules (when each runs next, in the company time zone), the latest
// jobs with their result or error, and the working-time check the clocks use. Changing the times is done in
// Configuration; holidays are in Lists → Holidays.

type JobRow = {
  id: string
  name: string
  label: string
  status: "queued" | "running" | "done" | "failed" | "dead"
  attempts: number
  maxAttempts: number
  runAt: string
  result: string | null
  lastError: string | null
  createdAt: string
  finishedAt: string | null
}

type Overview = {
  worker: { on: boolean; id: string }
  timezone: string
  now: string
  schedules: { name: string; label: string; when: string; nextRun: string; lastRun: { status: string; at: string; result: string | null; error: string | null } | null }[]
  jobs: JobRow[]
  counts: { queued: number; failed: number; dead: number }
}

type Calendar = { timezone: string; workDays: number[]; hours: string; holidays: string[]; now: string; workingNow: boolean; nextWorkingStart: string; plus4WorkingHours: string; plus3WorkingDays: string }

const STATUS: Record<string, { label: string; tone: Tone }> = {
  queued: { label: "Waiting", tone: TONES.GREY },
  running: { label: "Running", tone: TONES.BLUE },
  done: { label: "Done", tone: TONES.GREEN },
  failed: { label: "Failed, will retry", tone: TONES.AMBER },
  dead: { label: "Gave up", tone: TONES.RED },
}
const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function JobsSection() {
  const { can } = useSession()
  const data = useApi<Overview>("/jobs")
  const cal = useApi<Calendar>("/jobs/calendar")
  const canEdit = can("settings.edit")
  const reload = () => {
    void data.reload()
    void cal.reload()
  }

  return (
    <SectionCard
      value="jobs"
      title="Jobs"
      description="What runs in the background, when it runs next, and how each run went. Times are set in Configuration, in the company time zone."
      canEdit={canEdit}
      lock={false}
      action={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={reload}>
            <RotateCcw /> Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (await attempt(() => api.post("/jobs/test", { failTimes: 2 }), "Test job queued: it fails twice, then works. Refresh to watch it.")) reload()
            }}
          >
            <FlaskConical /> Run a test job
          </Button>
        </div>
      }
    >
      {data.error ? (
        <LoadError message={data.error} retry={data.reload} />
      ) : !data.data ? (
        <Loading />
      ) : (
        <>
          {!data.data.worker.on && <p className="rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-sm text-[#93370d]">This app instance doesn't run jobs (JOBS_WORKER=off). Another instance must, or nothing below will run.</p>}

          <Group title="Schedules" hint={`Now: ${data.data.now} (${data.data.timezone})`}>
            <ul className="divide-y overflow-hidden rounded-lg border">
              {data.data.schedules.map((s) => (
                <li key={s.name} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.4fr)_100px] items-center gap-3 px-4 py-2.5">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-xs text-muted-foreground">{s.when}</span>
                  </span>
                  <span className="text-sm">
                    <span className="block text-xs text-muted-foreground">Next run</span>
                    {s.nextRun}
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className="block text-xs text-muted-foreground">Last run</span>
                    {s.lastRun ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Chip tone={STATUS[s.lastRun.status]?.tone ?? TONES.GREY}>{STATUS[s.lastRun.status]?.label ?? s.lastRun.status}</Chip>
                        <span className="truncate text-xs text-muted-foreground">{s.lastRun.error ?? s.lastRun.result ?? ""}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </span>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (await attempt(() => api.post(`/jobs/schedules/${s.name}/run`), `${s.label} queued. It runs within a few seconds.`)) setTimeout(reload, 6000)
                      }}
                    >
                      <Play /> Run now
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Group>

          <Group title="Recent jobs" hint={`${data.data.counts.queued} waiting · ${data.data.counts.failed} retrying · ${data.data.counts.dead} gave up`}>
            {data.data.jobs.length ? (
              <ul className="divide-y overflow-hidden rounded-lg border">
                {data.data.jobs.map((j) => (
                  <li key={j.id} className="grid grid-cols-[minmax(0,1.1fr)_130px_minmax(0,1.8fr)_90px] items-center gap-3 px-4 py-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{j.label}</span>
                      <span className="text-xs text-muted-foreground">{dateTimeLabel(j.createdAt)}</span>
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <Chip tone={STATUS[j.status]?.tone ?? TONES.GREY}>{STATUS[j.status]?.label ?? j.status}</Chip>
                      <span className="text-[11px] text-muted-foreground">
                        Attempt {j.attempts} of {j.maxAttempts}
                      </span>
                    </span>
                    <span className={cn("min-w-0 text-xs", j.lastError && j.status !== "done" ? "text-destructive" : "text-muted-foreground")}>
                      {j.status === "done" ? j.result || "Done." : (j.lastError ?? "")}
                      {j.status === "failed" && <span className="block text-muted-foreground">Next try {dateTimeLabel(j.runAt)}</span>}
                    </span>
                    {canEdit && (j.status === "failed" || j.status === "dead") ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (await attempt(() => api.post(`/jobs/${j.id}/retry`), "Queued again.")) setTimeout(reload, 6000)
                        }}
                      >
                        Retry
                      </Button>
                    ) : (
                      <span />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">No jobs have run yet.</p>
            )}
          </Group>
        </>
      )}

      <Group title="Working time" hint="What the clocks count. Change it in Configuration → Working time and Lists → Holidays.">
        {cal.error ? (
          <LoadError message={cal.error} retry={cal.reload} />
        ) : !cal.data ? (
          <Loading />
        ) : (
          <dl className="grid grid-cols-[200px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Time zone</dt>
            <dd>{cal.data.timezone}</dd>
            <dt className="text-muted-foreground">Working days and hours</dt>
            <dd>
              {cal.data.workDays.map((d) => DAYS[d]).join(", ")} · {cal.data.hours}
            </dd>
            <dt className="text-muted-foreground">Holidays</dt>
            <dd>{cal.data.holidays.length ? cal.data.holidays.join(", ") : "None set"}</dd>
            <dt className="text-muted-foreground">Now</dt>
            <dd>
              {cal.data.now} · {cal.data.workingNow ? "working time" : `not working time (next start ${cal.data.nextWorkingStart})`}
            </dd>
            <dt className="text-muted-foreground">Now + 4 working hours</dt>
            <dd>{cal.data.plus4WorkingHours} (the reply clock)</dd>
            <dt className="text-muted-foreground">Now + 3 working days</dt>
            <dd>{cal.data.plus3WorkingDays} (the booking reminder)</dd>
          </dl>
        )}
      </Group>
    </SectionCard>
  )
}
