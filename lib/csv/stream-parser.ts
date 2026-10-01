// Incremental RFC 4180 CSV parser. Pure: no React or Next imports, safe in the browser and in tests.
import { IMPORT_MAX_CELL_CHARS } from "@/lib/import/lead-rows";

const COMMA = 44;
const QUOTE = 34;
const BACKSLASH = 92;
const CR = 13;
const LF = 10;
const BOM = 0xfeff;
/** A field longer than this stops the parse (usually a stray quote swallowing the rest of the file). */
export const CSV_MAX_FIELD_CHARS = IMPORT_MAX_CELL_CHARS * 2;

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
  let records = 0; // records completed so far; the header is row 1

  const checkFieldSize = () => {
    if (field.length <= CSV_MAX_FIELD_CHARS) return;
    const rowNumber = records + 1;
    throw new Error(
      inQuotes
        ? `Row ${rowNumber}: unterminated quote`
        : `Row ${rowNumber}: a cell is longer than ${CSV_MAX_FIELD_CHARS.toLocaleString("en-US")} characters`,
    );
  };

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
    if (!blank) {
      out.push(row);
      records++;
    }
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
          checkFieldSize();
          break;
        }
        field += s.slice(i, j);
        checkFieldSize();
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
      if (j > i) {
        field += s.slice(i, j);
        checkFieldSize();
      }
      if (j >= n) break;
      const c = s.charCodeAt(j);
      i = j + 1;
      if (c === COMMA) {
        endField();
      } else if (c === QUOTE) {
        // A quote opens a quoted section only at the start of a field; elsewhere
        // (e.g. `Acme 24" monitor`) it is a literal character.
        if (!quoted && field.trim() === "") {
          inQuotes = true;
          quoted = true;
          quoteStart = field.length;
        } else {
          field += '"';
          checkFieldSize();
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
 * Exact UTF-8 byte length of `JSON.stringify(value)` for a string, without building it.
 * Used to keep import batches under the request body limit.
 */
export function jsonStringBytes(value: string): number {
  let bytes = 2; // the surrounding quotes
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c === QUOTE || c === BACKSLASH) bytes += 2;
    else if (c < 0x20) bytes += c === 8 || c === 9 || c === 10 || c === 12 || c === 13 ? 2 : 6;
    else if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 6; // a lone surrogate is escaped as \uXXXX
    } else if (c >= 0xdc00 && c <= 0xdfff) bytes += 6;
    else bytes += 3;
  }
  return bytes;
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
