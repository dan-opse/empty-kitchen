export function parseCsv(text: string): Record<string, string>[] {
  const rows = splitCsvRows(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = (row[i] ?? "").trim();
    });
    return record;
  });
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

export function parseBool(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export function parseNumber(value: string): number {
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
