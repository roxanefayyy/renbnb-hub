import { addGuestPayment, deleteGuestPayment, markPaymentReceived } from "@/app/actions";
import { q } from "@/lib/db";
import { guestPayments } from "@/lib/data";
import { fmtDate, peso, today } from "@/lib/util";
import { AddForm, Badge, Card, Empty, Field, PageHeader, Select, Stat } from "@/components/ui";
import { MoneyTabs } from "../tabs";

export const dynamic = "force-dynamic";

const KINDS = [
  { value: "deposit", label: "Booking deposit" },
  { value: "balance", label: "Balance" },
  { value: "full", label: "Full payment" },
  { value: "security_deposit", label: "Security deposit (held)" },
  { value: "deposit_return", label: "Security deposit return (out)" },
  { value: "refund", label: "Refund (out)" },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

export default async function PaymentsPage() {
  const t = today();
  const [rows, accounts, leads] = await Promise.all([
    guestPayments(false),
    q<{ id: number; name: string }>(`SELECT id, name FROM accounts ORDER BY id`),
    q<{ id: number; name: string }>(`SELECT id, name FROM leads WHERE status IN ('quoted','booked') ORDER BY id DESC LIMIT 50`),
  ]);
  const open = rows.filter((r) => !r.received_date);
  const incoming = open.filter((r) => !["refund", "deposit_return"].includes(r.kind));
  const outgoing = open.filter((r) => ["refund", "deposit_return"].includes(r.kind));
  const heldDeposits =
    rows.filter((r) => r.kind === "security_deposit" && r.received_date).reduce((s, r) => s + r.amount, 0) -
    rows.filter((r) => r.kind === "deposit_return" && r.received_date).reduce((s, r) => s + r.amount, 0);
  const accName = (id: number | null) => accounts.find((a) => a.id === id)?.name ?? "";

  return (
    <div>
      <PageHeader eyebrow="Money · Direct bookings" title="Guest payments" />
      <MoneyTabs current="/money/payments" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Guests owe you" value={peso(incoming.reduce((s, r) => s + r.amount, 0))} sub={`${incoming.length} open`} />
        <Stat label="Overdue" value={incoming.filter((r) => r.due_date && r.due_date < t).length} tone={incoming.some((r) => r.due_date && r.due_date < t) ? "bad" : "good"} />
        <Stat label="You owe guests" value={peso(outgoing.reduce((s, r) => s + r.amount, 0))} sub="Refunds and deposit returns" />
        <Stat label="Security deposits held" value={peso(heldDeposits)} sub="Not revenue. Owed back." />
      </div>

      <AddForm label="Record or expect a GCash / bank payment" action={addGuestPayment}>
        <Field label="Guest"><input name="guest_name" required className="input w-full" /></Field>
        <Field label="Type"><Select name="kind" options={KINDS} defaultValue="balance" required /></Field>
        <Field label="Method"><Select name="method" options={[{ value: "bank", label: "Bank transfer / InstaPay" }, { value: "gcash", label: "GCash → business bank" }]} defaultValue="bank" required /></Field>
        <Field label="Amount ₱"><input type="number" step="0.01" name="amount" required className="input w-full" /></Field>
        <Field label="Due date"><input type="date" name="due_date" className="input w-full" /></Field>
        <Field label="Received on (blank = still waiting)"><input type="date" name="received_date" className="input w-full" /></Field>
        <Field label="Reference no."><input name="reference_no" className="input w-full" /></Field>
        <Field label="Landed in (business account)"><Select name="account_id" options={accounts.map((a) => ({ value: a.id, label: a.name }))} /></Field>
        <Field label="Lead"><Select name="lead_id" options={leads.map((l) => ({ value: l.id, label: l.name }))} /></Field>
        <Field label="Hospitable booking code"><input name="reservation_code" className="input w-full" /></Field>
        <Field label="Notes" className="col-span-2"><input name="notes" className="input w-full" /></Field>
      </AddForm>

      <Card>
        {rows.length === 0 ? <Empty>No direct payments yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Guest</th><th>Type</th><th>Method</th><th>Due</th><th>Status</th><th className="num">Amount</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const status = r.received_date ? "received" : r.due_date && r.due_date < t ? "overdue" : "pending";
                  const out = ["refund", "deposit_return"].includes(r.kind);
                  return (
                    <tr key={r.id}>
                      <td>{r.guest_name}{r.reservation_code ? <span className="block text-xs muted">{r.reservation_code}</span> : null}</td>
                      <td className="text-xs">{KIND_LABEL[r.kind] ?? r.kind}</td>
                      <td className="text-xs uppercase">{r.method}</td>
                      <td className="whitespace-nowrap">{fmtDate(r.due_date)}</td>
                      <td><Badge tone={status}>{status === "received" ? `${out ? "sent" : "received"} ${fmtDate(r.received_date)}` : status}</Badge>
                        {r.reference_no && <span className="block text-xs muted">ref {r.reference_no}{r.account_id ? ` · ${accName(r.account_id)}` : ""}</span>}</td>
                      <td className={`num ${out ? "text-bad" : ""}`}>{out ? "-" : ""}{peso(r.amount, { decimals: true })}</td>
                      <td className="text-right whitespace-nowrap">
                        {!r.received_date && (
                          <form action={markPaymentReceived} className="inline-flex gap-1">
                            <input type="hidden" name="id" value={r.id} />
                            <input name="reference_no" placeholder="ref" className="input !py-1 !px-2 w-20 text-xs" />
                            <button className="btn-sm">{out ? "Sent ✓" : "Got it ✓"}</button>
                          </form>
                        )}
                        <form action={deleteGuestPayment} className="inline ml-1"><input type="hidden" name="id" value={r.id} /><button className="text-xs text-timber/40 hover:text-bad">✕</button></form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs muted mt-3">This page tracks cash collection. Revenue still comes from the booking in Hospitable, so enter every direct booking there too and the calendars stay synced.</p>
      </Card>
    </div>
  );
}
