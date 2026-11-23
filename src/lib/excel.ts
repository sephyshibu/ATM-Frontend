import readXlsxFile, { readSheetNames } from "read-excel-file"

// Reads an Excel (.xlsx) or CSV file in the browser into rows of text, for the import screens. Nothing is sent
// anywhere here: the import screen maps the columns and sends the mapped rows to the server to check.

export type Sheet = { name: string; rows: string[][] }

const MAX_BYTES = 20 * 1024 * 1024

const pad = (n: number) => String(n).padStart(2, "0")

/** Every cell as text; dates as 2026-03-31. */
function cellText(c: unknown): string {
  if (c === null || c === undefined) return ""
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? "" : `${c.getUTCFullYear()}-${pad(c.getUTCMonth() + 1)}-${pad(c.getUTCDate())}`
  if (typeof c === "boolean") return c ? "Yes" : "No"
  return String(c).trim()
}

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes. Semicolons too, if that's the separator. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "")
  const firstLine = src.slice(0, src.indexOf("\n") === -1 ? undefined : src.indexOf("\n"))
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ","
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"' && field === "") quoted = true
    else if (ch === sep) {
      row.push(field.trim())
      field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ""
    } else field += ch
  }
  if (field !== "" || row.length) {
    row.push(field.trim())
    rows.push(row)
  }
  return rows
}

/** Drops rows that are entirely empty at the end and pads every row to the same width. */
function tidy(rows: string[][]): string[][] {
  let end = rows.length
  while (end > 0 && rows[end - 1].every((c) => c === "")) end--
  const kept = rows.slice(0, end)
  const width = Math.max(0, ...kept.map((r) => r.length))
  return kept.map((r) => [...r, ...Array(width - r.length).fill("")])
}

/** The sheets in the file (a CSV is one sheet). Throws a plain sentence if the file can't be read. */
export async function readSheets(file: File): Promise<Sheet[]> {
  if (file.size > MAX_BYTES) throw new Error("The file is larger than 20 MB. Split it and import it in parts.")
  const name = file.name.toLowerCase()
  if (name.endsWith(".csv") || name.endsWith(".txt")) return [{ name: file.name, rows: tidy(parseCsv(await file.text())) }]
  if (name.endsWith(".xls")) throw new Error("Old .xls files can't be read. In Excel, choose File → Save As → Excel Workbook (.xlsx), then upload that.")
  if (!name.endsWith(".xlsx")) throw new Error("Upload an Excel file (.xlsx) or a CSV file.")
  try {
    const names = await readSheetNames(file)
    const sheets: Sheet[] = []
    for (const sheet of names) {
      const rows = await readXlsxFile(file, { sheet })
      sheets.push({ name: sheet, rows: tidy(rows.map((r) => r.map(cellText))) })
    }
    return sheets
  } catch {
    throw new Error("The file couldn't be read as an Excel workbook. Open it in Excel, save it as .xlsx, and try again.")
  }
}

/** A CSV file of rows, for "Download the rejected rows" and templates. */
export function downloadCsv(fileName: string, rows: string[][]) {
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const blob = new Blob(["﻿" + rows.map((r) => r.map((c) => esc(c ?? "")).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
