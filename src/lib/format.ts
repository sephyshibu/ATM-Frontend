import { format, isThisYear, isToday, isYesterday } from "date-fns"

// Dates, counts and names, the way the app writes them: "18 Nov", "Today, 09:12", "3 people", "JC".

export const dateLabel = (iso: string | Date) => {
  const d = new Date(iso)
  return format(d, isThisYear(d) ? "d MMM" : "d MMM yyyy")
}

export const dateTimeLabel = (iso: string | Date) => {
  const d = new Date(iso)
  if (isToday(d)) return `Today, ${format(d, "HH:mm")}`
  if (isYesterday(d)) return `Yesterday, ${format(d, "HH:mm")}`
  return `${dateLabel(d)}, ${format(d, "HH:mm")}`
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "22 Dec" from "12-22" (a month-day). */
export const monthDayLabel = (md: string) => {
  const [m, d] = md.split("-").map(Number)
  if (!m || !d) return md
  return format(new Date(2026, m - 1, d), "d MMM")
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")

export const numberLabel = (n: number) => n.toLocaleString("en-US")
