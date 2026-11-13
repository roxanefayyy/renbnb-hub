import Link from "next/link";
import { q } from "@/lib/db";
import { billSchedule, cashPosition, getLeads, kpis, monthly, occupancyGrid, reservationsOverlapping, guestPayments } from "@/lib/data";
import { addDays, CHANNEL_LABEL, daysInMonth, fmtDate, OCCUPANCY_TARGET, peso, pct, REVENUE_TARGET, today } from "@/lib/util";
import { Badge, Bar, Card, Empty, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const INBOXES = [
  { label: "Hospitable", sub: "Airbnb · Booking · Agoda · Direct", href: "https://my.hospitable.com/inbox" },
  { label: "Meta Business Suite", sub: "Messenger · Instagram · WhatsApp", href: "https://business.facebook.com/latest/inbox/all" },
  { label: "WhatsApp Web", sub: "If not linked to Meta yet", href: "https://web.whatsapp.com" },
  { label: "TikTok messages", sub: "DMs from TikTok", href: "https://www.tiktok.com/messages" },
];

export default async function Today() {
  const t = today();
  const month = t.slice(0, 7);
  const [stays, grid, leads, bills, cash, payments, tasks, mrows] = await Promise.all([
    reservationsOverlapping(addDays(t, -1), addDays(t, 2)),
    occupancyGrid(t, 14),
    getLeads(),
    billSchedule(addDays(t, -60), addDays(t, 7)),
    cashPosition(),
    guestPayments(true),
    q<{ id: number; title: string; priority: string; due: string | null; owner: string }>(
      `SELECT id, title, priority, due, owner FROM tasks WHERE NOT done ORDER BY
        CASE priority WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, due NULLS LAST LIMIT 5`,
    ),
    monthly(month, month),
  ]);

  const checkins = stays.filter((s) => s.checkin === t);
  const checkouts = stays.filter((s) => s.checkout === t);
  const inHouse = stays.filter((s) => s.checkin < t && s.checkout > t);
  const tomorrowIn = stays.filter((s) => s.checkin === addDays(t, 1));

  const openLeads = leads.filter((l) => l.status === "new" || l.status === "quoted");
  const dueLeads = openLeads.filter((l) => !l.follow_up || l.follow_up <= t);
  const unpaidBills = bills.filter((b) => !b.paid);
  const overdueBills = unpaidBills.filter((b) => b.due < t);
  const weekBills = unpaidBills.filter((b) => b.due >= t);
  const owed = payments.filter((p) => p.kind !== "refund" && p.kind !== "deposit_return");
  const owedOverdue = owed.filter((p) => p.due_date && p.due_date < t);

  const m = mrows[0];
  const k = m ? kpis(m) : null;
  const dayOfMonth = Number(t.slice(8, 10));
  const pace = m ? (m.net / dayOfMonth) * daysInMonth(t) : 0;
  const emptyByProp = grid.grid.map((g) => ({ name: g.name, empty: g.nights.filter((n) => !n).length }));
  const emptyNext7 = grid.grid.reduce((s, g) => s + g.nights.slice(0, 7).filter((n) => !n).length, 0);

  const flags: { tone: "bad" | "warn"; text: string; href: string }[] = [];
  if (overdueBills.length) flags.push({ tone: "bad", text: `${overdueBills.length} bill(s) overdue · ${peso(overdueBills.reduce((s, b) => s + b.bill.amount, 0))}`, href: "/money/bills" });
  if (owedOverdue.length) flags.push({ tone: "bad", text: `${owedOverdue.length} guest payment(s) overdue`, href: "/money/payments" });
  if (dueLeads.length) flags.push({ tone: "warn", text: `${dueLeads.length} lead(s) need a follow-up today`, href: "/leads" });
  if (emptyNext7 >= 15) flags.push({ tone: "warn", text: `${emptyNext7} empty unit-nights in the next 7 days. Run a promo or drop rates.`, href: "/calendar" });
  if (!cash.oldestCheck || cash.oldestCheck < addDays(t, -7))
    flags.push({ tone: "warn", text: "Cash balances not checked in 7+ days. Update them in Money.", href: "/money" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="eyebrow mb-1">
            {new Date(t + "T00:00:00Z").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}
          </div>
          <h1 className="h1">Today</h1>
        </div>
        <Link href="/leads" className="btn">+ Log a lead</Link>
      </div>

      {flags.length > 0 && (
        <div className="space-y-2">
          {flags.map((f) => (
            <Link key={f.text} href={f.href}
              className={`block rounded-lg px-4 py-2.5 text-sm font-medium border ${f.tone === "bad" ? "bg-bad/10 border-bad/20 text-bad" : "bg-maple/15 border-maple/30 text-rustic"}`}>
              {f.tone === "bad" ? "🚨 " : "⚠ "}{f.text} →
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Check-ins today" value={checkins.length} sub={`${tomorrowIn.length} tomorrow`} />
        <Stat label="Check-outs / turnovers" value={checkouts.length} sub={`${inHouse.length} staying over`} />
        <Stat label="Next 14 days occupancy" value={pct(grid.occupancy)} tone={grid.occupancy >= OCCUPANCY_TARGET ? "good" : grid.occupancy >= 0.5 ? "warn" : "bad"} sub={`Target ${pct(OCCUPANCY_TARGET)}`} />
        <Stat label="Cash on hand" value={peso(cash.total)} sub={cash.oldestCheck ? `Checked ${fmtDate(cash.oldestCheck)}` : "Not checked yet"} />
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <Card title="Inboxes" className="md:col-span-1">
          <div className="space-y-2">
            {INBOXES.map((i) => (
              <a key={i.label} href={i.href} target="_blank" rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-timber/10 px-3 py-2 hover:border-rustic">
                <div>
                  <div className="text-sm font-medium">{i.label}</div>
                  <div className="text-xs muted">{i.sub}</div>
                </div>
                <span className="text-rustic">↗</span>
              </a>
            ))}
          </div>
          <p className="text-xs muted mt-3">Standard: reply to new inquiries within 15 min, 8am–10pm. Push alerts come from the Hospitable and Meta Business Suite phone apps.</p>
        </Card>

        <Card title="Guests today" className="md:col-span-2">
          {checkins.length + checkouts.length === 0 ? (
            <Empty>No check-ins or check-outs today.</Empty>
          ) : (
            <table className="tbl">
              <thead><tr><th></th><th>Unit</th><th>Guest</th><th>Channel</th><th className="num">Nights</th></tr></thead>
              <tbody>
                {checkins.map((s) => (
                  <tr key={"in" + s.code}><td><Badge tone="booked">IN</Badge></td><td>{s.property}</td><td>{s.guest_name ?? s.code}</td><td>{CHANNEL_LABEL[s.platform]}</td><td className="num">{s.nights}</td></tr>
                ))}
                {checkouts.map((s) => (
                  <tr key={"out" + s.code}><td><Badge tone="quoted">OUT</Badge></td><td>{s.property}</td><td>{s.guest_name ?? s.code}</td><td>{CHANNEL_LABEL[s.platform]}</td><td className="num">{s.nights}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <Card title="Leads to follow up" action={<Link href="/leads" className="btn-sm">All leads</Link>}>
          {dueLeads.length === 0 ? <Empty>Nothing due. {openLeads.length} open lead(s).</Empty> : (
            <ul className="space-y-2">
              {dueLeads.slice(0, 6).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium">{l.name} <span className="muted font-normal">· {l.source}</span></div>
                    <div className="text-xs muted">{l.checkin ? `${fmtDate(l.checkin)}–${fmtDate(l.checkout)}` : "No dates"}{l.guests ? ` · ${l.guests} pax` : ""}</div>
                  </div>
                  <Badge>{l.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Money this week" action={<Link href="/money" className="btn-sm">Money</Link>}>
          <div className="space-y-3 text-sm">
            <div>
              <div className="label">Bills due (next 7 days)</div>
              {weekBills.length === 0 && overdueBills.length === 0 ? <div className="muted">None</div> : (
                <ul className="space-y-1">
                  {[...overdueBills, ...weekBills].slice(0, 6).map((b) => (
                    <li key={b.bill.id + b.due} className="flex justify-between">
                      <span className={b.due < t ? "text-bad" : ""}>{fmtDate(b.due)} · {b.bill.name}</span>
                      <span className="tabular-nums">{peso(b.bill.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="label">Guests owe you (GCash / bank)</div>
              {owed.length === 0 ? <div className="muted">None open</div> : (
                <div className="flex justify-between"><span>{owed.length} open</span><span className="tabular-nums font-medium">{peso(owed.reduce((s, p) => s + p.amount, 0))}</span></div>
              )}
            </div>
          </div>
        </Card>

        <Card title="Top tasks" action={<Link href="/tasks" className="btn-sm">Tasks</Link>}>
          {tasks.length === 0 ? <Empty>No open tasks.</Empty> : (
            <ul className="space-y-2">
              {tasks.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{x.title}{x.owner !== "Roxanne" && <span className="muted"> · {x.owner}</span>}</span>
                  <span className="flex items-center gap-1">
                    {x.due && <span className={`text-xs ${x.due < t ? "text-bad" : "muted"}`}>{fmtDate(x.due)}</span>}
                    <Badge>{x.priority}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Card title="This month (by check-in)" action={<Link href="/metrics" className="btn-sm">Metrics</Link>}>
          {!m || !k || m.bookings === 0 ? <Empty>No bookings loaded yet. Sync Hospitable or import a CSV in Settings.</Empty> : (
            <div className="space-y-3 text-sm">
              <div>
                <div className="flex justify-between mb-1"><span>Net revenue {peso(m.net)}</span><span className="muted">Pace {peso(pace)} / target {peso(REVENUE_TARGET)}</span></div>
                <Bar value={m.net} max={REVENUE_TARGET} tone={pace >= REVENUE_TARGET ? "bg-good" : "bg-maple"} />
              </div>
              <div>
                <div className="flex justify-between mb-1"><span>Occupancy {pct(k.occupancy)}</span><span className="muted">target {pct(OCCUPANCY_TARGET)}</span></div>
                <Bar value={k.occupancy} max={1} tone={k.occupancy >= OCCUPANCY_TARGET ? "bg-good" : "bg-maple"} />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div><div className="label">Bookings</div><div className="font-medium">{m.bookings}</div></div>
                <div><div className="label">Avg stay</div><div className="font-medium">{k.los.toFixed(2)} nts</div></div>
                <div><div className="label">Direct share</div><div className="font-medium">{pct(k.directShare)}</div></div>
              </div>
            </div>
          )}
        </Card>

        <Card title="Empty nights · next 14 days" action={<Link href="/calendar" className="btn-sm">Calendar</Link>}>
          <ul className="space-y-2">
            {emptyByProp.map((p) => (
              <li key={p.name} className="text-sm">
                <div className="flex justify-between mb-1"><span>{p.name}</span><span className={p.empty >= 7 ? "text-bad font-medium" : "muted"}>{p.empty} empty</span></div>
                <Bar value={14 - p.empty} max={14} tone={p.empty >= 7 ? "bg-bad/70" : "bg-good"} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
