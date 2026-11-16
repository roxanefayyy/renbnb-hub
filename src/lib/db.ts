import "server-only";

/**
 * Tiny SQL layer. Production: Postgres via DATABASE_URL (Neon on Vercel).
 * Local dev without DATABASE_URL: embedded PGlite stored in ./.data.
 */
type Row = Record<string, unknown>;
type Runner = (text: string, params?: unknown[]) => Promise<Row[]>;

const g = globalThis as unknown as { __hubRunner?: Promise<Runner> };

/** Neon/Vercel may name the variable differently depending on the prefix chosen when connecting. */
export function databaseUrl(): string | undefined {
  const env = process.env;
  return (
    env.DATABASE_URL ||
    env.POSTGRES_URL ||
    Object.entries(env).find(([k, v]) => v && /(_DATABASE_URL|_POSTGRES_URL)$/.test(k) && !/UNPOOLED|NON_POOLING/.test(k))?.[1]
  );
}

async function makeRunner(): Promise<Runner> {
  const url = databaseUrl();
  if (!url && process.env.VERCEL) {
    throw new Error(
      "No database connected. In Vercel open Storage → your Neon database → Connect Project → renbnb-hub (Production), then redeploy.",
    );
  }
  if (url) {
    const postgres = (await import("postgres")).default;
    const sql = postgres(url, { ssl: "require", max: 3, idle_timeout: 20, prepare: false, onnotice: () => {} });
    const run: Runner = async (text, params = []) =>
      (await sql.unsafe(text, params as never[])) as unknown as Row[];
    if (!(await schemaIsCurrent(run))) {
      // Several serverless instances can boot at once: serialize schema setup with an advisory lock
      await sql.begin(async (tx) => {
        await tx.unsafe(`SELECT pg_advisory_xact_lock(724001)`);
        const txRun: Runner = async (text, params = []) => (await tx.unsafe(text, params as never[])) as unknown as Row[];
        if (!(await schemaIsCurrent(txRun))) await ensureSchema(txRun);
      });
    }
    return run;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("fs");
  mkdirSync("./.data", { recursive: true });
  const db = new PGlite("./.data/pglite");
  const run: Runner = async (text, params = []) => {
    if (params.length === 0 && text.includes(";")) {
      await db.exec(text);
      return [];
    }
    const res = await db.query(text, params as unknown[]);
    return res.rows as Row[];
  };
  await ensureSchema(run);
  return run;
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!g.__hubRunner) {
    g.__hubRunner = makeRunner();
    g.__hubRunner.catch(() => (g.__hubRunner = undefined)); // retry on next request instead of staying broken
  }
  const run = await g.__hubRunner;
  return (await run(text, params)) as T[];
}

export async function one<T = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await q<T>(text, params);
  return rows[0];
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    keyword TEXT,
    units INT NOT NULL DEFAULT 1,
    is_combo BOOLEAN NOT NULL DEFAULT FALSE,
    hospitable_id TEXT,
    csv_property_id TEXT,
    live_date TEXT DEFAULT '2026-01-01',
    sort INT DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS reservations (
    code TEXT PRIMARY KEY,
    hospitable_id TEXT,
    property_id INT REFERENCES properties(id),
    platform TEXT NOT NULL,
    status TEXT NOT NULL,
    checkin TEXT NOT NULL,
    checkout TEXT NOT NULL,
    nights INT NOT NULL DEFAULT 0,
    guests INT DEFAULT 0,
    pets INT DEFAULT 0,
    guest_name TEXT,
    gross DOUBLE PRECISION DEFAULT 0,
    platform_fee DOUBLE PRECISION DEFAULT 0,
    net_revenue DOUBLE PRECISION DEFAULT 0,
    adjustments DOUBLE PRECISION DEFAULT 0,
    expected_cash_date TEXT,
    actual_cash_date TEXT,
    source TEXT NOT NULL DEFAULT 'csv',
    raw JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS reservations_checkin ON reservations(checkin)`,
  `CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    created_on TEXT NOT NULL,
    source TEXT NOT NULL,
    name TEXT NOT NULL,
    contact TEXT,
    checkin TEXT,
    checkout TEXT,
    guests INT,
    property_interest TEXT,
    quote DOUBLE PRECISION,
    status TEXT NOT NULL DEFAULT 'new',
    lost_reason TEXT,
    follow_up TEXT,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'bank',
    opening_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
    opening_date TEXT NOT NULL DEFAULT '2026-01-01'
  )`,
  `CREATE TABLE IF NOT EXISTS balance_checks (
    id SERIAL PRIMARY KEY,
    account_id INT REFERENCES accounts(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    balance DOUBLE PRECISION NOT NULL,
    UNIQUE(account_id, date)
  )`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    date TEXT NOT NULL,
    property_id INT REFERENCES properties(id),
    category TEXT NOT NULL,
    description TEXT,
    amount DOUBLE PRECISION NOT NULL,
    account_id INT REFERENCES accounts(id),
    vendor TEXT,
    receipt_no TEXT,
    receipt_url TEXT,
    bill_id INT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS bills (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    day INT NOT NULL DEFAULT 1,
    property_id INT REFERENCES properties(id),
    account_id INT REFERENCES accounts(id),
    start_date TEXT NOT NULL DEFAULT '2026-01-01',
    end_date TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS bill_payments (
    id SERIAL PRIMARY KEY,
    bill_id INT REFERENCES bills(id) ON DELETE CASCADE,
    due_date TEXT NOT NULL,
    paid_date TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    expense_id INT,
    UNIQUE(bill_id, due_date)
  )`,
  `CREATE TABLE IF NOT EXISTS guest_payments (
    id SERIAL PRIMARY KEY,
    guest_name TEXT NOT NULL,
    reservation_code TEXT,
    lead_id INT REFERENCES leads(id) ON DELETE SET NULL,
    kind TEXT NOT NULL DEFAULT 'balance',
    method TEXT NOT NULL DEFAULT 'gcash',
    amount DOUBLE PRECISION NOT NULL,
    due_date TEXT,
    received_date TEXT,
    reference_no TEXT,
    account_id INT REFERENCES accounts(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT 'Ops',
    priority TEXT NOT NULL DEFAULT 'Medium',
    due TEXT,
    owner TEXT NOT NULL DEFAULT 'Roxanne',
    done BOOLEAN NOT NULL DEFAULT FALSE,
    created_on TEXT NOT NULL,
    done_on TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS content_posts (
    id SERIAL PRIMARY KEY,
    date TEXT NOT NULL,
    platform TEXT NOT NULL,
    pillar TEXT NOT NULL,
    title TEXT NOT NULL,
    caption TEXT,
    status TEXT NOT NULL DEFAULT 'idea',
    link TEXT,
    inquiries INT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    at TIMESTAMPTZ DEFAULT now(),
    source TEXT NOT NULL,
    summary TEXT NOT NULL,
    ok BOOLEAN NOT NULL DEFAULT TRUE
  )`,
];

export const PROPERTY_SEED = [
  { name: "Casa de Jasmine", code: "305", keyword: "jasmine", units: 1, combo: false, sort: 1 },
  { name: "Casa de Sofia", code: "0420", keyword: "sofia", units: 1, combo: false, sort: 2 },
  { name: "Casa de Anais", code: "307", keyword: "anais", units: 1, combo: false, sort: 3 },
  { name: "Casa de Lena", code: "0415", keyword: "lena", units: 1, combo: false, sort: 4 },
  { name: "Casa de Aurora", code: "0316", keyword: "aurora", units: 1, combo: false, sort: 5 },
  { name: "Casa de Olivia", code: "0315", keyword: "olivia", units: 1, combo: false, sort: 6 },
  { name: "Twin Casa", code: "000", keyword: "twin", units: 2, combo: true, sort: 7 },
];

const SCHEMA_VERSION = "2";

async function schemaIsCurrent(run: Runner): Promise<boolean> {
  const t = await run(`SELECT to_regclass('public.settings') AS t`, []);
  if (!t[0]?.t) return false;
  const v = await run(`SELECT value FROM settings WHERE key='schema_version'`, []);
  return v[0]?.value === SCHEMA_VERSION;
}

// Old category → Roxanne's chart of accounts (Nov 2026)
const CATEGORY_REMAP: [string, string][] = [
  ["Association dues", "Condo Dues"],
  ["Repairs & maintenance", "Maintenance & Repairs"],
  ["Housekeeping labor", "Cleaning Fee"],
  ["Laundry & linen", "Laundry"],
  ["Guest supplies", "Supplies"],
  ["Amortization / rent", "Mortgages"],
  ["Software / channel manager", "Hospitable"],
  ["Salaries (Rhea/staff)", "Operations Manager"],
  ["Marketing & content", "Marketing & Ads"],
  ["Permits & taxes", "Legal & Permits"],
  ["Professional fees", "Legal & Permits"],
];

/** Each migration is idempotent and runs once, in order, when schema_version is behind. */
const MIGRATIONS: Record<number, (run: Runner) => Promise<void>> = {
  2: async (run) => {
    // Business accounts: Metrobank + Maribank. GCash is personal, so it's removed from the books.
    const metro = await run(`SELECT id FROM accounts WHERE name='Metrobank'`, []);
    if (!metro.length) {
      const b1 = await run(`SELECT id FROM accounts WHERE name='Bank 1'`, []);
      if (b1.length) await run(`UPDATE accounts SET name='Metrobank', kind='bank' WHERE id=$1`, [b1[0].id]);
      else await run(`INSERT INTO accounts (name, kind) VALUES ('Metrobank','bank')`, []);
    }
    await run(`INSERT INTO accounts (name, kind) VALUES ('Maribank','bank') ON CONFLICT (name) DO NOTHING`, []);
    const g = await run(`SELECT id FROM accounts WHERE name='GCash'`, []);
    if (g.length) {
      const id = g[0].id;
      for (const t of ["expenses", "bills", "guest_payments"]) await run(`UPDATE ${t} SET account_id=NULL WHERE account_id=$1`, [id]);
      await run(`DELETE FROM accounts WHERE id=$1`, [id]);
    }
    // Balances as of 2026-11-16 (from Roxanne)
    for (const [name, bal] of [["Metrobank", 10070.77], ["Maribank", 3958.4]] as const) {
      await run(
        `INSERT INTO balance_checks (account_id, date, balance) SELECT id, '2026-11-16', $2 FROM accounts WHERE name=$1
         ON CONFLICT (account_id, date) DO UPDATE SET balance=EXCLUDED.balance`,
        [name, bal],
      );
    }
    for (const [from, to] of CATEGORY_REMAP) {
      await run(`UPDATE expenses SET category=$2 WHERE category=$1`, [from, to]);
      await run(`UPDATE bills SET category=$2 WHERE category=$1`, [from, to]);
    }
  },
};

async function ensureSchema(run: Runner) {
  for (const stmt of SCHEMA) await run(stmt, []);
  for (const p of PROPERTY_SEED) {
    await run(
      `INSERT INTO properties (name, code, keyword, units, is_combo, sort) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (name) DO NOTHING`,
      [p.name, p.code, p.keyword, p.units, p.combo, p.sort],
    );
  }
  const acc = await run(`SELECT count(*)::int AS n FROM accounts`, []);
  if (Number(acc[0]?.n ?? 0) === 0) {
    for (const [name, kind] of [
      ["Metrobank", "bank"],
      ["Maribank", "bank"],
      ["Petty Cash (Rhea)", "petty"],
    ]) {
      await run(`INSERT INTO accounts (name, kind) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [name, kind]);
    }
  }
  const cur = await run(`SELECT value FROM settings WHERE key='schema_version'`, []);
  const from = Number(cur[0]?.value ?? 1);
  for (let v = from + 1; v <= Number(SCHEMA_VERSION); v++) await MIGRATIONS[v]?.(run);
  await run(
    `INSERT INTO settings (key, value) VALUES ('schema_version', $1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
    [SCHEMA_VERSION],
  );
}
