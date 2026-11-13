import { addAccount, logout, renameAccount, runSync, uploadCsv } from "@/app/actions";
import { q, databaseUrl } from "@/lib/db";
import { getProperties } from "@/lib/bookings";
import { Card, Field, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const [props, accounts, log, counts] = await Promise.all([
    getProperties(),
    q<{ id: number; name: string; kind: string; opening_balance: number; opening_date: string }>(`SELECT id, name, kind, opening_balance::float8 AS opening_balance, opening_date FROM accounts ORDER BY id`),
    q<{ id: number; at: string; source: string; summary: string; ok: boolean }>(`SELECT id, at::text AS at, source, summary, ok FROM sync_log ORDER BY id DESC LIMIT 8`),
    q<{ n: number; latest: string | null; src: string | null }>(`SELECT count(*)::int AS n, max(checkin) AS latest, string_agg(DISTINCT source, ', ') AS src FROM reservations`),
  ]);
  const hasToken = !!process.env.HOSPITABLE_TOKEN;
  const hasDb = !!databaseUrl();

  return (
    <div>
      <PageHeader eyebrow="Setup" title="Settings">
        <form action={logout}><button className="btn-ghost">Log out</button></form>
      </PageHeader>
      {msg && <div className="rounded-lg px-4 py-2.5 text-sm border bg-sage border-timber/10 mb-5">{msg}</div>}

      <div className="grid md:grid-cols-2 gap-5">
        <Card title="Bookings data">
          <div className="text-sm space-y-1 mb-4">
            <div>Reservations stored: <b>{counts[0]?.n ?? 0}</b>{counts[0]?.src ? <span className="muted"> ({counts[0].src})</span> : null}</div>
            <div>Latest check-in: <b>{counts[0]?.latest ?? "–"}</b></div>
            <div>Hospitable connection: {hasToken ? <b className="text-good">token set</b> : <b className="text-bad">not connected</b>}</div>
            <div>Database: {hasDb ? <b className="text-good">Postgres</b> : <b className="text-warn">local dev database</b>}</div>
          </div>
          <form action={runSync} className="mb-4">
            <SubmitButton disabled={!hasToken} pending="Syncing… can take up to a minute">Sync Hospitable now</SubmitButton>
            <p className="text-xs muted mt-1">{hasToken ? "It also syncs automatically every day at 5am." : "Add HOSPITABLE_TOKEN in Vercel to turn this on."}</p>
          </form>
          <form action={uploadCsv} className="space-y-2">
            <Field label="Or import a Hospitable CSV (Metrics → Exports → Reservations & Financials)">
              <input type="file" name="file" accept=".csv" className="input w-full" />
            </Field>
            <SubmitButton className="btn-ghost" pending="Importing…">Import CSV</SubmitButton>
            <p className="text-xs muted">Re-importing is safe. Bookings update by code and never duplicate. Check-ins before Jan 1, 2026 are skipped.</p>
          </form>
        </Card>

        <Card title="Sync log">
          {log.length === 0 ? <p className="text-sm muted">Nothing yet.</p> : (
            <ul className="text-xs space-y-2">
              {log.map((l) => (
                <li key={l.id} className={l.ok ? "" : "text-bad"}><span className="muted">{l.at.slice(0, 16)} · {l.source}</span><br />{l.summary}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Cash accounts">
          <div className="space-y-2">
            {accounts.map((a) => (
              <form key={a.id} action={renameAccount} className="flex gap-2 items-end">
                <input type="hidden" name="id" value={a.id} />
                <Field label="Name" className="flex-1"><input name="name" defaultValue={a.name} className="input w-full" /></Field>
                <Field label="Balance on Jan 1, 2026"><input name="opening_balance" type="number" step="0.01" defaultValue={a.opening_balance} className="input w-36" /></Field>
                <button className="btn-sm mb-1">Save</button>
              </form>
            ))}
          </div>
          <form action={addAccount} className="flex gap-2 items-end mt-4 pt-4 border-t border-timber/10">
            <Field label="New account" className="flex-1"><input name="name" placeholder="e.g. BPI, Maya" className="input w-full" required /></Field>
            <Field label="Type"><select name="kind" className="input"><option value="bank">Bank</option><option value="gcash">E-wallet</option><option value="petty">Petty cash</option></select></Field>
            <button className="btn-sm mb-1">Add</button>
          </form>
        </Card>

        <Card title="Units">
          <table className="tbl">
            <thead><tr><th>Unit</th><th>Code</th><th>Units</th><th>Hospitable</th></tr></thead>
            <tbody>
              {props.map((p) => (
                <tr key={p.id}><td>{p.name}</td><td>{p.code}</td><td>{p.units}</td><td className="text-xs">{p.hospitable_id ? <span className="text-good">linked</span> : <span className="muted">not linked</span>}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs muted mt-2">Listings are matched by name (Jasmine, Sofia, Anais, Lena, Aurora, Olivia, Twin). Twin Casa blocks Aurora and Olivia.</p>
        </Card>
      </div>
    </div>
  );
}
