import { markPayout, saveBalances } from "@/app/actions";
import { q } from "@/lib/db";
import { cashForecast, cashPosition } from "@/lib/data";
import { addDays, CHANNEL_LABEL, fmtDate, peso, today } from "@/lib/util";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { MoneyTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const t = today();
  const [pos, fc, overduePayouts] = await Promise.all([
    cashPosition(),
    cashForecast(91),
    q<{ code: string; platform: string; property: string; expected_cash_date: string; net_revenue: number }>(
      `SELECT r.code, r.platform, p.name AS property, r.expected_cash_date, r.net_revenue::float8 AS net_revenue
       FROM reservations r JOIN properties p ON p.id=r.property_id
       WHERE r.status='accepted' AND r.platform<>'direct' AND r.actual_cash_date IS NULL
         AND r.expected_cash_date BETWEEN $1 AND $2 ORDER BY r.expected_cash_date DESC LIMIT 40`,
      [addDays(t, -14), t],
    ),
  ]);
  const maxAbs = Math.max(1, ...fc.weeks.map((w) => Math.max(w.inflow, w.outflow)));

  return (
    <div>
      <PageHeader eyebrow="Money" title="Cashflow" />
      <MoneyTabs current="/money" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Cash now" value={peso(fc.start)} sub={pos.oldestCheck ? `Oldest check ${fmtDate(pos.oldestCheck)}` : "Enter balances below"} />
        <Stat label="In 30 days" value={peso(fc.h30.closing)} sub={`+${peso(fc.h30.inflow)} / -${peso(fc.h30.outflow)}`} tone={fc.h30.closing < 0 ? "bad" : undefined} />
        <Stat label="In 60 days" value={peso(fc.h60.closing)} sub={`+${peso(fc.h60.inflow)} / -${peso(fc.h60.outflow)}`} tone={fc.h60.closing < 0 ? "bad" : undefined} />
        <Stat label="Lowest point (90d)" value={peso(fc.low.balance)} sub={`week of ${fmtDate(fc.low.week)}`} tone={fc.low.balance < 0 ? "bad" : fc.low.balance < 50000 ? "warn" : "good"} />
      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-5">
        <Card title="Daily cash check (2 min)">
          <form action={saveBalances} className="space-y-2">
            <input type="date" name="date" defaultValue={t} className="input w-full" />
            {pos.accounts.map((a) => (
              <label key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{a.name}<span className="block text-xs muted">{a.last_date ? `last ${peso(a.last_balance)} on ${fmtDate(a.last_date)}` : "never checked"}</span></span>
                <input name={`bal_${a.id}`} type="number" step="0.01" placeholder="balance" className="input w-32 text-right" />
              </label>
            ))}
            <button className="btn w-full">Save balances</button>
          </form>
          <p className="text-xs muted mt-2">Type what the bank or GCash app shows. The forecast starts from these numbers.</p>
        </Card>

        <Card title="13-week forecast" className="md:col-span-2">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Week of</th><th className="num">In</th><th className="num">Out</th><th className="w-1/3"></th><th className="num">Closing</th></tr></thead>
              <tbody>
                {fc.weeks.map((w) => (
                  <tr key={w.start}>
                    <td className="whitespace-nowrap">{fmtDate(w.start)}</td>
                    <td className="num text-good">{w.inflow ? peso(w.inflow) : "–"}</td>
                    <td className="num text-bad">{w.outflow ? peso(w.outflow) : "–"}</td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <div className="h-1.5 bg-good/70 rounded" style={{ width: `${(w.inflow / maxAbs) * 100}%` }} />
                        <div className="h-1.5 bg-bad/60 rounded" style={{ width: `${(w.outflow / maxAbs) * 100}%` }} />
                      </div>
                    </td>
                    <td className={`num font-medium ${w.closing < 0 ? "text-bad" : ""}`}>{peso(w.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs muted mt-2">Counts only bookings already made (platform payouts on expected dates), open guest payments, and your bills. New bookings are upside, not counted.</p>
        </Card>
      </div>

      <Card title="Payouts that should have landed (last 14 days)">
        {overduePayouts.length === 0 ? <Empty>All caught up.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Expected</th><th>Channel</th><th>Unit</th><th>Code</th><th className="num">Net</th><th></th></tr></thead>
            <tbody>
              {overduePayouts.map((r) => (
                <tr key={r.code}>
                  <td>{fmtDate(r.expected_cash_date)}</td><td>{CHANNEL_LABEL[r.platform]}</td><td>{r.property}</td><td className="text-xs muted">{r.code}</td>
                  <td className="num">{peso(r.net_revenue)}</td>
                  <td className="text-right">
                    <form action={markPayout} className="inline-flex gap-1">
                      <input type="hidden" name="code" value={r.code} />
                      <input type="hidden" name="date" value={t} />
                      <button className="btn-sm">Received ✓</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs muted mt-2">Tick these off as payouts hit the bank. Anything left here after 7 days needs chasing in Airbnb, Booking.com or Agoda.</p>
      </Card>
    </div>
  );
}
