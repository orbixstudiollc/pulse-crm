// Incremental RFC 4180 CSV parser. Pure: no React or Next imports, safe in the browser and in tests.

const COMMA = 44;
const QUOTE = 34;
const CR = 13;
const LF = 10;
const BOM = 0xfeff;

export interface CsvParser {
  /** Feeds the next chunk; returns the records completed by it. */
  push(chunk: string): string[][];
  /** Flushes the last record (a missing final newline is fine). */
  end(): string[][];
}

export function createCsvParser(): CsvParser {
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let quotePending = false; // saw `"` inside quotes; the next char decides escape or close
  let skipLF = false; // a record just ended on `\r`; swallow a following `\n`
  let started = false;
  let quoted = false; // the current field has a quoted section
  let quoteStart = 0; // field offsets of the quoted section, kept verbatim
  let quoteEnd = 0;

  const endField = () => {
    // Trim whitespace outside quotes only; quoted content is kept as-is.
    const value = quoted
      ? field.slice(0, quoteStart).trimStart() + field.slice(quoteStart, quoteEnd) + field.slice(quoteEnd).trimEnd()
      : field.trim();
    row.push(value);
    field = "";
    quoted = false;
    quoteStart = 0;
    quoteEnd = 0;
  };

  const endRecord = (out: string[][]) => {
    const blank = row.length === 0 && !quoted && field.trim() === "";
    endField();
    if (!blank) out.push(row);
    row = [];
  };

  const push = (chunk: string): string[][] => {
    const out: string[][] = [];
    let s = chunk;
    if (!started && s.length > 0) {
      started = true;
      if (s.charCodeAt(0) === BOM) s = s.slice(1);
    }
    const n = s.length;
    let i = 0;
    while (i < n) {
      if (skipLF) {
        skipLF = false;
        if (s.charCodeAt(i) === LF) {
          i++;
          continue;
        }
      }
      if (quotePending) {
        quotePending = false;
        if (s.charCodeAt(i) === QUOTE) {
          field += '"';
          i++;
          continue;
        }
        inQuotes = false;
        quoteEnd = field.length;
      }
      if (inQuotes) {
        const j = s.indexOf('"', i);
        if (j === -1) {
          field += s.slice(i);
          break;
        }
        field += s.slice(i, j);
        quotePending = true;
        i = j + 1;
        continue;
      }
      let j = i;
      while (j < n) {
        const c = s.charCodeAt(j);
        if (c === COMMA || c === QUOTE || c === CR || c === LF) break;
        j++;
      }
      if (j > i) field += s.slice(i, j);
      if (j >= n) break;
      const c = s.charCodeAt(j);
      i = j + 1;
      if (c === COMMA) {
        endField();
      } else if (c === QUOTE) {
        inQuotes = true;
        if (!quoted) {
          quoted = true;
          quoteStart = field.length;
        }
      } else {
        endRecord(out);
        if (c === CR) skipLF = true;
      }
    }
    return out;
  };

  const end = (): string[][] => {
    const out: string[][] = [];
    if (quotePending || inQuotes) {
      // Closing quote, or an unterminated quote at end of input.
      quotePending = false;
      inQuotes = false;
      quoteEnd = field.length;
    }
    skipLF = false;
    if (row.length > 0 || field.length > 0 || quoted) endRecord(out);
    return out;
  };

  return { push, end };
}

/**
 * Reads only the first `maxBytes` of a CSV file for preview and field mapping.
 * A trailing partial record (cut by the byte limit) is dropped.
 */
export async function readCsvPreview(
  file: File,
  maxBytes = 1_048_576,
): Promise<{ headers: string[]; rows: string[][] }> {
  const buffer = await file.slice(0, maxBytes).arrayBuffer();
  const text = new TextDecoder().decode(new Uint8Array(buffer), { stream: true });
  const parser = createCsvParser();
  const records = parser.push(text);
  if (file.size <= maxBytes) records.push(...parser.end());
  const [headers = [], ...rows] = records;
  return { headers, rows };
}
