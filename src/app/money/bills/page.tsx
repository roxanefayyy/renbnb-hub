import { addBill, deleteBill, payBill, toggleBill } from "@/app/actions";
import { q } from "@/lib/db";
import { getProperties } from "@/lib/bookings";
import { billSchedule, getBills } from "@/lib/data";
import { addDays, fmtDate, peso, today } from "@/lib/util";
import { AddForm, CategorySelect, Badge, Card, Empty, Field, PageHeader, Select, Stat } from "@/components/ui";
import { MoneyTabs } from "../tabs";

export const dynamic = "force-dynamic";
const WEEKDAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function BillsPage() {
  const t = today();
  const [props, accounts, bills, sched] = await Promise.all([
    getProperties(),
    q<{ id: number; name: string }>(`SELECT id, name FROM accounts ORDER BY id`),
    getBills(),
    billSchedule(addDays(t, -60), addDays(t, 30)),
  ]);
  const upcoming = sched.filter((s) => !s.paid);
  const overdue = upcoming.filter((s) => s.due < t);
  const next30 = upcoming.filter((s) => s.due >= t);
  const monthlyLoad = bills.filter((b) => b.active).reduce((s, b) => s + (b.frequency === "weekly" ? (b.amount * 52) / 12 : b.frequency === "monthly" ? b.amount : 0), 0);

  return (
    <div>
      <PageHeader eyebrow="Money" title="Bills & disbursements" />
      <MoneyTabs current="/money/bills" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Stat label="Fixed outflow / month" value={peso(monthlyLoad)} sub="All active recurring bills" />
        <Stat label="Overdue" value={overdue.length} sub={peso(overdue.reduce((s, x) => s + x.bill.amount, 0))} tone={overdue.length ? "bad" : "good"} />
        <Stat label="Due next 30 days" value={peso(next30.reduce((s, x) => s + x.bill.amount, 0))} sub={`${next30.length} payments`} />
      </div>

      <AddForm label="Add recurring bill (amortization, dues, salary, utilities…)" action={addBill}>
        <Field label="Name"><input name="name" placeholder="e.g. Jasmine amortization" className="input w-full" required /></Field>
        <Field label="Amount ₱"><input type="number" step="0.01" name="amount" className="input w-full" required /></Field>
        <Field label="Category"><CategorySelect /></Field>
        <Field label="Repeats"><Select name="frequency" options={[{ value: "monthly", label: "Monthly" }, { value: "weekly", label: "Weekly" }, { value: "once", label: "One-time" }]} defaultValue="monthly" required /></Field>
        <Field label="Day (1–31 monthly · 1 Mon–7 Sun weekly)"><input type="number" name="day" min={1} max={31} defaultValue={1} className="input w-full" /></Field>
        <Field label="Unit"><Select name="property_id" options={props.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        <Field label="Paid from"><Select name="account_id" options={accounts.map((a) => ({ value: a.id, label: a.name }))} /></Field>
        <Field label="Starts (one-time: due date)"><input type="date" name="start_date" defaultValue={t} className="input w-full" /></Field>
        <Field label="Ends (optional)"><input type="date" name="end_date" className="input w-full" /></Field>
        <Field label="Notes" className="col-span-2 md:col-span-3"><input name="notes" placeholder="lender, account no. hint, etc." className="input w-full" /></Field>
      </AddForm>

      <div className="grid md:grid-cols-2 gap-5">
        <Card title="To pay">
          {upcoming.length === 0 ? <Empty>Nothing due in the next 30 days.</Empty> : (
            <table className="tbl">
              <thead><tr><th>Due</th><th>Bill</th><th className="num">Amount</th><th></th></tr></thead>
              <tbody>
                {upcoming.map((s) => (
                  <tr key={s.bill.id + s.due}>
                    <td className={`whitespace-nowrap ${s.due < t ? "text-bad font-medium" : ""}`}>{fmtDate(s.due)}</td>
                    <td>{s.bill.name}<span className="block text-xs muted">{s.bill.category}</span></td>
                    <td className="num">{peso(s.bill.amount)}</td>
                    <td className="text-right">
                      <form action={payBill} className="inline-flex gap-1">
                        <input type="hidden" name="bill_id" value={s.bill.id} />
                        <input type="hidden" name="due_date" value={s.due} />
                        <input type="hidden" name="paid_date" value={t} />
                        <button className="btn-sm">Paid ✓</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs muted mt-2">&ldquo;Paid ✓&rdquo; logs the expense for you, so you never type it twice.</p>
        </Card>

        <Card title="All recurring bills">
          {bills.length === 0 ? <Empty>Add your amortizations, condo dues, Rhea&apos;s weekly pay, cleaners, utilities and subscriptions.</Empty> : (
            <table className="tbl">
              <thead><tr><th>Bill</th><th>Schedule</th><th className="num">Amount</th><th></th></tr></thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id} className={b.active ? "" : "opacity-50"}>
                    <td>{b.name}<span className="block text-xs muted">{b.category}</span></td>
                    <td className="text-xs whitespace-nowrap">{b.frequency === "weekly" ? `Every ${WEEKDAYS[b.day]}` : b.frequency === "once" ? `Once · ${fmtDate(b.start_date)}` : `Monthly · day ${b.day}`}{b.end_date ? ` · until ${fmtDate(b.end_date)}` : ""}</td>
                    <td className="num">{peso(b.amount)}</td>
                    <td className="text-right whitespace-nowrap">
                      <form action={toggleBill} className="inline"><input type="hidden" name="id" value={b.id} /><button className="btn-sm mr-1">{b.active ? "Pause" : "Resume"}</button></form>
                      <form action={deleteBill} className="inline"><input type="hidden" name="id" value={b.id} /><button className="text-xs text-timber/40 hover:text-bad">✕</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {bills.some((b) => !b.active) && <div className="mt-2"><Badge tone="lost">Paused bills are left out of the forecast</Badge></div>}
        </Card>
      </div>
    </div>
  );
}
