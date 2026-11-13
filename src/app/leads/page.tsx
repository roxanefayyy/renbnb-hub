import { addLead, deleteLead, updateLead } from "@/app/actions";
import { getLeads, leadStats } from "@/lib/data";
import { getProperties } from "@/lib/bookings";
import { addDays, fmtDate, LEAD_SOURCES, LEAD_STATUSES, LOST_REASONS, peso, pct, today } from "@/lib/util";
import { AddForm, Badge, Card, Empty, Field, PageHeader, Select, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const t = today();
  const [leads, stats, props] = await Promise.all([getLeads(s), leadStats(addDays(t, -30)), getProperties()]);
  const propNames = props.map((p) => p.name);
  const open = leads.filter((l) => l.status === "new" || l.status === "quoted");

  return (
    <div>
      <PageHeader eyebrow="Direct booking pipeline" title="Leads" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Leads (30 days)" value={stats.total} />
        <Stat label="Booked (30 days)" value={stats.booked} />
        <Stat label="Conversion" value={pct(stats.rate)} tone={stats.rate >= 0.3 ? "good" : stats.rate >= 0.15 ? "warn" : stats.total ? "bad" : undefined} sub="Aim for 30%+" />
        <Stat label="Open now" value={open.length} sub={`${open.filter((l) => !l.follow_up || l.follow_up <= t).length} due today`} />
      </div>

      <AddForm label="Log a lead (takes 20 seconds)" action={addLead}>
        <Field label="Name"><input name="name" required className="input w-full" /></Field>
        <Field label="Source"><Select name="source" options={LEAD_SOURCES} defaultValue="WhatsApp" required /></Field>
        <Field label="Contact (number / handle)"><input name="contact" className="input w-full" /></Field>
        <Field label="Unit wanted"><Select name="property_interest" options={["Any", ...propNames]} /></Field>
        <Field label="Check-in"><input type="date" name="checkin" className="input w-full" /></Field>
        <Field label="Check-out"><input type="date" name="checkout" className="input w-full" /></Field>
        <Field label="Guests"><input type="number" name="guests" min={1} max={24} className="input w-full" /></Field>
        <Field label="Quote (₱)"><input type="number" name="quote" step="1" className="input w-full" /></Field>
        <Field label="Status"><Select name="status" options={[...LEAD_STATUSES]} defaultValue="new" required /></Field>
        <Field label="Follow up on"><input type="date" name="follow_up" defaultValue={t} className="input w-full" /></Field>
        <Field label="Notes" className="col-span-2"><input name="notes" className="input w-full" /></Field>
      </AddForm>

      <div className="flex flex-wrap gap-2 mb-3 text-sm">
        {["", ...LEAD_STATUSES].map((x) => (
          <a key={x || "all"} href={x ? `/leads?s=${x}` : "/leads"} className={`btn-sm ${s === x || (!s && !x) ? "border-rustic text-rustic" : ""}`}>
            {x || "all"}
          </a>
        ))}
      </div>

      <Card>
        {leads.length === 0 ? <Empty>No leads yet. Log every WhatsApp, Messenger, IG and TikTok inquiry here, including the ones that go quiet.</Empty> : (
          <div className="divide-y divide-timber/5">
            {leads.map((l) => (
              <details key={l.id} className="py-2 group">
                <summary className="cursor-pointer list-none grid grid-cols-12 gap-2 items-center text-sm">
                  <span className="col-span-4 md:col-span-3 font-medium">{l.name}<span className="block text-xs muted font-normal">{l.source}{l.contact ? ` · ${l.contact}` : ""}</span></span>
                  <span className="col-span-4 md:col-span-3 text-xs">{l.checkin ? `${fmtDate(l.checkin)} – ${fmtDate(l.checkout)}` : <span className="muted">no dates</span>}{l.guests ? ` · ${l.guests} pax` : ""}<span className="block muted">{l.property_interest ?? ""}</span></span>
                  <span className="hidden md:block md:col-span-2 tabular-nums">{l.quote ? peso(l.quote) : <span className="muted">–</span>}</span>
                  <span className="hidden md:block md:col-span-2 text-xs">{l.status === "lost" ? l.lost_reason ?? "" : l.follow_up ? <span className={l.follow_up <= t ? "text-bad font-medium" : "muted"}>follow up {fmtDate(l.follow_up)}</span> : ""}</span>
                  <span className="col-span-4 md:col-span-2 text-right"><Badge>{l.status}</Badge></span>
                </summary>
                <form action={updateLead} className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2 bg-linen/60 rounded-lg p-3">
                  <input type="hidden" name="id" value={l.id} />
                  <Field label="Status"><Select name="status" options={[...LEAD_STATUSES]} defaultValue={l.status} required /></Field>
                  <Field label="Quote ₱"><input type="number" name="quote" defaultValue={l.quote ?? ""} className="input w-full" /></Field>
                  <Field label="Follow up"><input type="date" name="follow_up" defaultValue={l.follow_up ?? ""} className="input w-full" /></Field>
                  <Field label="If lost, why"><Select name="lost_reason" options={LOST_REASONS} defaultValue={l.lost_reason} /></Field>
                  <Field label="Check-in"><input type="date" name="checkin" defaultValue={l.checkin ?? ""} className="input w-full" /></Field>
                  <Field label="Check-out"><input type="date" name="checkout" defaultValue={l.checkout ?? ""} className="input w-full" /></Field>
                  <Field label="Guests"><input type="number" name="guests" defaultValue={l.guests ?? ""} className="input w-full" /></Field>
                  <Field label="Unit"><Select name="property_interest" options={["Any", ...propNames]} defaultValue={l.property_interest} /></Field>
                  <Field label="Notes" className="col-span-2 md:col-span-4"><input name="notes" defaultValue={l.notes ?? ""} className="input w-full" /></Field>
                  <div className="col-span-2 md:col-span-6 flex gap-2">
                    <button className="btn">Update</button>
                    <button formAction={deleteLead} className="btn-ghost text-bad">Delete</button>
                  </div>
                </form>
              </details>
            ))}
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        <Card title="Where bookings come from (30 days)">
          {stats.bySource.length === 0 ? <Empty>No data yet.</Empty> : (
            <table className="tbl">
              <thead><tr><th>Source</th><th className="num">Leads</th><th className="num">Booked</th><th className="num">Rate</th><th className="num">Value</th></tr></thead>
              <tbody>{stats.bySource.map((r) => (
                <tr key={r.source}><td>{r.source}</td><td className="num">{r.total}</td><td className="num">{r.booked}</td><td className="num">{pct(r.rate)}</td><td className="num">{peso(r.bookedValue)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card title="Why leads are lost">
          {stats.lost.length === 0 ? <Empty>No lost leads logged.</Empty> : (
            <ul className="text-sm space-y-1">{stats.lost.map((r) => <li key={r.lost_reason} className="flex justify-between"><span>{r.lost_reason}</span><span>{r.n}</span></li>)}</ul>
          )}
          <p className="text-xs muted mt-3">If &ldquo;Price&rdquo; leads, test the group rate. If &ldquo;No reply&rdquo; leads, your follow-up is the leak.</p>
        </Card>
      </div>
    </div>
  );
}
