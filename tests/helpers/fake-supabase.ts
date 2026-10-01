// Minimal in-memory stand-in for the supabase-js query builder, covering the
// calls lib/mcp makes. Rows are plain objects keyed by table name.

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

function likeToRegExp(pattern: string): RegExp {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) {
      out += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (ch === "%") out += ".*";
    else if (ch === "_") out += ".";
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`, "i");
}

class Query implements PromiseLike<{ data: unknown; error: null; count: number | null }> {
  private filters: Filter[] = [];
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private cols = "*";
  private wantCount = false;
  private head = false;
  private orders: { col: string; asc: boolean }[] = [];
  private from_ = 0;
  private to_: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(private db: FakeSupabase, private table: string) {}

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    this.cols = cols;
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(values: Row | Row[]) { this.op = "insert"; this.payload = values; return this; }
  update(values: Row) { this.op = "update"; this.payload = values; return this; }
  delete() { this.op = "delete"; return this; }

  eq(col: string, v: unknown) { this.filters.push((r) => r[col] === v); return this; }
  in(col: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[col])); return this; }
  is(col: string, v: unknown) { this.filters.push((r) => (r[col] ?? null) === v); return this; }
  not(col: string, op: string, v: unknown) {
    if (op !== "is") throw new Error(`fake: not.${op} unsupported`);
    this.filters.push((r) => (r[col] ?? null) !== v);
    return this;
  }
  lt(col: string, v: string) { this.filters.push((r) => r[col] != null && String(r[col]) < v); return this; }
  gte(col: string, v: string) { this.filters.push((r) => r[col] != null && String(r[col]) >= v); return this; }
  lte(col: string, v: string) { this.filters.push((r) => r[col] != null && String(r[col]) <= v); return this; }
  or(expr: string) {
    const parts = expr.split(",").map((p) => {
      const [col, op, ...rest] = p.split(".");
      if (op !== "ilike") throw new Error(`fake: or ${op} unsupported`);
      const re = likeToRegExp(rest.join("."));
      return (r: Row) => re.test(String(r[col] ?? ""));
    });
    this.filters.push((r) => parts.some((f) => f(r)));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending ?? true }); return this; }
  range(from: number, to: number) { this.from_ = from; this.to_ = to; return this; }
  limit(n: number) { this.to_ = this.from_ + n - 1; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private project(row: Row): Row {
    if (this.cols.trim() === "*") return { ...row };
    const out: Row = {};
    for (const c of this.cols.split(",").map((s) => s.trim())) out[c] = row[c] ?? null;
    return out;
  }

  private run(): { data: unknown; error: { message: string } | null; count: number | null } {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    const match = (r: Row) => this.filters.every((f) => f(r));
    let result: Row[];

    if (this.op === "insert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      result = items.map((v) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...v }));
      rows.push(...result);
    } else if (this.op === "update") {
      result = rows.filter(match);
      for (const r of result) Object.assign(r, this.payload);
    } else if (this.op === "delete") {
      result = rows.filter(match);
      this.db.tables[this.table] = rows.filter((r) => !match(r));
    } else {
      result = rows.filter(match);
    }
    this.db.log.push({ table: this.table, op: this.op });

    const count = result.length;
    for (const o of [...this.orders].reverse()) {
      result = [...result].sort((a, b) => {
        const x = a[o.col] as string | number, y = b[o.col] as string | number;
        if (x === y) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : 1) * (o.asc ? 1 : -1);
      });
    }
    if (this.to_ !== null) result = result.slice(this.from_, this.to_ + 1);
    const data = this.head ? null : result.map((r) => this.project(r));

    if (this.mode !== "many") {
      const list = (data ?? []) as Row[];
      if (this.mode === "single" && list.length !== 1) return { data: null, error: { message: "not single" }, count: null };
      return { data: list[0] ?? null, error: null, count: null };
    }
    return { data, error: null, count: this.wantCount ? count : null };
  }

  then<T1, T2>(
    onfulfilled?: ((v: { data: unknown; error: null; count: number | null }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.run() as { data: unknown; error: null; count: number | null }).then(onfulfilled, onrejected);
  }
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {};
  log: { table: string; op: string }[] = [];
  constructor(seed: Record<string, Row[]> = {}) {
    for (const [t, rows] of Object.entries(seed)) this.tables[t] = rows.map((r) => ({ ...r }));
  }
  from(table: string) {
    return new Query(this, table);
  }
}
