import { addExpense, deleteExpense } from "@/app/actions";
import { q } from "@/lib/db";
import { getProperties } from "@/lib/bookings";
import { CATEGORY_ICON, categoryGroup, fmtDate, monthLabel, OWNER_DRAW, peso, today } from "@/lib/util";
import { AddForm, CategorySelect, Card, Empty, Field, PageHeader, Select } from "@/components/ui";
import { MoneyTabs } from "../tabs";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const month = m ?? today().slice(0, 7);
  const [props, accounts, rows, months] = await Promise.all([
    getProperties(),
    q<{ id: number; name: string }>(`SELECT id, name FROM accounts ORDER BY id`),
    q<{ id: number; date: string; category: string; description: string | null; amount: number; vendor: string | null; receipt_no: string | null; receipt_url: string | null; property: string | null; account: string | null; bill_id: number | null }>(
      `SELECT e.id, e.date, e.category, e.description, e.amount::float8 AS amount, e.vendor, e.receipt_no, e.receipt_url, e.bill_id,
         p.name AS property, a.name AS account
       FROM expenses e LEFT JOIN properties p ON p.id=e.property_id LEFT JOIN accounts a ON a.id=e.account_id
       WHERE substr(e.date,1,7)=$1 ORDER BY e.date DESC, e.id DESC`,
      [month],
    ),
    q<{ m: string }>(`SELECT DISTINCT substr(date,1,7) AS m FROM expenses ORDER BY 1 DESC LIMIT 18`),
  ]);
  const total = rows.filter((r) => r.category !== OWNER_DRAW).reduce((s, r) => s + r.amount, 0);
  const byCat = Object.entries(rows.reduce<Record<string, number>>((a, r) => ((a[r.category] = (a[r.category] ?? 0) + r.amount), a), {})).sort((a, b) => b[1] - a[1]);
  const noReceipt = rows.filter((r) => !r.receipt_no && !r.receipt_url && r.category !== OWNER_DRAW).length;
  const monthOpts = Array.from(new Set([today().slice(0, 7), ...months.map((x) => x.m)]));

  return (
    <div>
      <PageHeader eyebrow="Money" title="Expenses">
        <form className="flex gap-2"><select name="m" defaultValue={month} className="input">{monthOpts.map((x) => <option key={x} value={x}>{monthLabel(x)}</option>)}</select><button className="btn-ghost">Go</button></form>
      </PageHeader>
      <MoneyTabs current="/money/expenses" />

      <AddForm label="Add expense" action={addExpense}>
        <Field label="Date"><input type="date" name="date" defaultValue={today()} className="input w-full" required /></Field>
        <Field label="Amount ₱"><input type="number" step="0.01" name="amount" className="input w-full" required /></Field>
        <Field label="Category"><CategorySelect /></Field>
        <Field label="Unit"><Select name="property_id" options={props.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        <Field label="Paid from"><Select name="account_id" options={accounts.map((a) => ({ value: a.id, label: a.name }))} /></Field>
        <Field label="Vendor"><input name="vendor" className="input w-full" /></Field>
        <Field label="OR / receipt no."><input name="receipt_no" className="input w-full" /></Field>
        <Field label="Receipt link (Drive)"><input name="receipt_url" className="input w-full" /></Field>
        <Field label="Description" className="col-span-2 md:col-span-4"><input name="description" className="input w-full" /></Field>
      </AddForm>

      <div className="grid md:grid-cols-3 gap-5">
        <Card title={`${monthLabel(month)} · ${peso(total)}`} className="md:col-span-2">
          {rows.length === 0 ? <Empty>No expenses logged this month.</Empty> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Category</th><th>What</th><th>Unit</th><th>From</th><th className="num">Amount</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="whitespace-nowrap">{CATEGORY_ICON[r.category] ?? ""} {r.category}</td>
                      <td>{r.description ?? ""}{r.vendor ? <span className="muted"> · {r.vendor}</span> : ""}
                        {r.receipt_url ? <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-rustic text-xs ml-1">receipt ↗</a> : !r.receipt_no && r.category !== OWNER_DRAW ? <span className="text-xs text-warn ml-1">no receipt</span> : null}
                      </td>
                      <td className="text-xs">{r.property ?? "Shared"}</td>
                      <td className="text-xs">{r.account ?? "–"}</td>
                      <td className="num">{peso(r.amount, { decimals: true })}</td>
                      <td><form action={deleteExpense}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-timber/40 hover:text-bad">✕</button></form></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="By category">
          {byCat.length === 0 ? <Empty>–</Empty> : (
            <div className="space-y-3">
              {["Direct costs", "Operational costs", "Other", "Owner draw"].map((grp) => {
                const items = byCat.filter(([c]) => categoryGroup(c) === grp);
                if (!items.length) return null;
                return (
                  <div key={grp}>
                    <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-rustic mb-1">
                      <span>{grp}</span><span className="tabular-nums">{peso(items.reduce((s, [, v]) => s + v, 0))}</span>
                    </div>
                    <ul className="text-sm space-y-1">{items.map(([c, v]) => <li key={c} className="flex justify-between"><span>{CATEGORY_ICON[c] ?? ""} {c}</span><span className="tabular-nums">{peso(v)}</span></li>)}</ul>
                  </div>
                );
              })}
            </div>
          )}
          {noReceipt > 0 && <p className="text-xs text-warn mt-3">{noReceipt} expense(s) without a receipt. Without receipts they can&apos;t be deducted.</p>}
        </Card>
      </div>
    </div>
  );
}
