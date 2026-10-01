import { describe, expect, it } from "vitest";
import { CSV_MAX_FIELD_CHARS, createCsvParser, jsonStringBytes, readCsvPreview } from "@/lib/csv/stream-parser";

function parseChunks(chunks: string[]): string[][] {
  const parser = createCsvParser();
  const records: string[][] = [];
  for (const chunk of chunks) records.push(...parser.push(chunk));
  records.push(...parser.end());
  return records;
}

const parseAll = (text: string) => parseChunks([text]);

describe("createCsvParser", () => {
  it("parses simple records", () => {
    expect(parseAll("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas, newlines and escaped quotes", () => {
    const text = 'name,note\n"Doe, John","line1\nline2\r\nline3"\n"say ""hi""",x\n';
    expect(parseAll(text)).toEqual([
      ["name", "note"],
      ["Doe, John", "line1\nline2\r\nline3"],
      ['say "hi"', "x"],
    ]);
  });

  it("accepts \\r\\n and lone \\r record endings", () => {
    expect(parseAll("a,b\r\n1,2\r\n3,4\r5,6")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });

  it("strips a leading UTF-8 BOM only at the very start", () => {
    expect(parseAll("\uFEFFname,email\nx,y")).toEqual([
      ["name", "email"],
      ["x", "y"],
    ]);
    expect(parseChunks(["\uFEFF", "a\nb"])).toEqual([["a"], ["b"]]);
  });

  it("skips blank and whitespace-only lines", () => {
    expect(parseAll("a,b\n\n   \r\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps lines of empty fields (they are not blank)", () => {
    expect(parseAll("a,b\n,\n")).toEqual([
      ["a", "b"],
      ["", ""],
    ]);
  });

  it("handles a missing final newline", () => {
    expect(parseAll("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseAll('a\n"quoted"')).toEqual([["a"], ["quoted"]]);
  });

  it("trims unquoted whitespace but keeps whitespace inside quotes", () => {
    expect(parseAll('  a  ,  "  b  "  , c\n')).toEqual([["a", "  b  ", "c"]]);
  });

  it("keeps an empty quoted field as a record", () => {
    expect(parseAll('""\n')).toEqual([[""]]);
  });

  it("closes an unterminated quote at end of input", () => {
    expect(parseAll('a\n"open,still')).toEqual([["a"], ["open,still"]]);
  });

  it("only returns complete records from push()", () => {
    const parser = createCsvParser();
    expect(parser.push("a,b\n1,")).toEqual([["a", "b"]]);
    expect(parser.push('"x\ny"')).toEqual([]);
    expect(parser.push("\n")).toEqual([["1", "x\ny"]]);
    expect(parser.end()).toEqual([]);
  });

  it("gives the same result for every split position of a tricky sample", () => {
    const sample =
      '\uFEFFName, Email ,Note\r\n' +
      '"Doe, ""JD"" John",jd@example.com,"multi\r\nline\nnote"\r\n' +
      '\r\n' +
      '  Ann  ,ann@example.com,""""\r' +
      '"x",,"tail"';
    const expected = parseAll(sample);
    expect(expected).toEqual([
      ["Name", "Email", "Note"],
      ['Doe, "JD" John', "jd@example.com", "multi\r\nline\nnote"],
      ["Ann", "ann@example.com", '"'],
      ["x", "", "tail"],
    ]);

    for (let i = 0; i <= sample.length; i++) {
      expect(parseChunks([sample.slice(0, i), sample.slice(i)]), `split at ${i}`).toEqual(expected);
    }
    for (let i = 0; i <= sample.length; i++) {
      for (let j = i; j <= sample.length; j++) {
        const chunks = [sample.slice(0, i), sample.slice(i, j), sample.slice(j)];
        expect(parseChunks(chunks), `split at ${i},${j}`).toEqual(expected);
      }
    }
    expect(parseChunks(sample.split("")), "one char per chunk").toEqual(expected);
  });

  it("keeps a quote in the middle of an unquoted field literal", () => {
    const sample = 'name,product,qty\nAnn,Acme 24" monitor,1\nBob,desk,2\nCy,5\'10" stand "XL",3\n';
    const expected = [
      ["name", "product", "qty"],
      ["Ann", 'Acme 24" monitor', "1"],
      ["Bob", "desk", "2"],
      ["Cy", '5\'10" stand "XL"', "3"],
    ];
    expect(parseAll(sample)).toEqual(expected);
    for (let i = 0; i <= sample.length; i++) {
      expect(parseChunks([sample.slice(0, i), sample.slice(i)]), `split at ${i}`).toEqual(expected);
    }
  });

  it("treats a quote after a closed quoted section as literal", () => {
    expect(parseAll('"a" "b",c\nnext,row\n')).toEqual([
      ['a "b"', "c"],
      ["next", "row"],
    ]);
  });

  it("still opens a quote after leading whitespace", () => {
    expect(parseAll('x,  "a,b"\n')).toEqual([["x", "a,b"]]);
  });

  it("accepts a quoted field exactly at the field limit", () => {
    const cell = "y".repeat(CSV_MAX_FIELD_CHARS);
    expect(parseAll(`h\n"${cell}"\n`)).toEqual([["h"], [cell]]);
  });

  it("throws 'Row N: unterminated quote' instead of growing a quoted field without bound", () => {
    const parser = createCsvParser();
    expect(parser.push("name,note\nAnn,ok\n")).toHaveLength(2);
    expect(parser.push('Bob,"never closed')).toEqual([]);
    const chunk = "z".repeat(1000) + "\n";
    let pushed = 0;
    const feed = () => {
      for (let k = 0; k < 1000; k++) {
        parser.push(chunk);
        pushed++;
      }
    };
    expect(feed).toThrow(/^Row 3: unterminated quote$/);
    // Stopped right after the cap, long before the 1000 chunks (about 1 MB) were consumed.
    expect(pushed).toBe(Math.floor(CSV_MAX_FIELD_CHARS / chunk.length));
  });

  it("throws when an unquoted field passes the field limit", () => {
    const parser = createCsvParser();
    parser.push("h\n");
    expect(() => parser.push("x".repeat(CSV_MAX_FIELD_CHARS + 1))).toThrow(/^Row 2: a cell is longer than/);
  });
});

describe("jsonStringBytes", () => {
  it("matches the UTF-8 size of JSON.stringify", () => {
    const samples = [
      "",
      "plain ascii",
      'quote " and backslash \\',
      "tab\tnewline\nreturn\rbell\u0007nul\u0000",
      "José Zoë ñ",
      "日本語のテキスト",
      "emoji 😀 pair",
      "lone \ud800 high and \udc00 low",
    ];
    for (const s of samples) {
      expect(jsonStringBytes(s), JSON.stringify(s)).toBe(new TextEncoder().encode(JSON.stringify(s)).length);
    }
  });

  it("counts more than one byte per char for non-ASCII text", () => {
    const s = "€".repeat(1000);
    expect(s.length).toBe(1000);
    expect(jsonStringBytes(s)).toBe(3002);
  });
});

describe("readCsvPreview", () => {
  it("reads headers and rows from a small file", async () => {
    const file = new File(["\uFEFFname,email\nAnn,a@x.com\nBob,b@x.com"], "leads.csv");
    expect(await readCsvPreview(file)).toEqual({
      headers: ["name", "email"],
      rows: [
        ["Ann", "a@x.com"],
        ["Bob", "b@x.com"],
      ],
    });
  });

  it("drops a trailing partial record when the file is larger than maxBytes", async () => {
    const text = "name,email\nAnn,a@x.com\nBob,b@x.com\n";
    const cut = text.indexOf("Bob") + 2; // inside the third record
    const file = new File([text], "leads.csv");
    expect(await readCsvPreview(file, cut)).toEqual({
      headers: ["name", "email"],
      rows: [["Ann", "a@x.com"]],
    });
  });

  it("does not corrupt a multi-byte character cut by the byte limit", async () => {
    const text = "name\nJosé\nZoë\n";
    const bytes = new TextEncoder().encode(text);
    const cut = bytes.length - 2; // splits the two-byte "ë"
    const file = new File([bytes], "leads.csv");
    expect(await readCsvPreview(file, cut)).toEqual({ headers: ["name"], rows: [["José"]] });
  });

  it("returns empty headers for an empty file", async () => {
    expect(await readCsvPreview(new File([""], "empty.csv"))).toEqual({ headers: [], rows: [] });
  });
});
