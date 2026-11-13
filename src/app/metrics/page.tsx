import { byProperty, channelMix, kpis, monthly } from "@/lib/data";
import { addMonths, BOOKS_START, CHANNEL_LABEL, daysInMonth, monthLabel, OCCUPANCY_TARGET, peso, pct, PHYSICAL_UNITS, REVENUE_TARGET, today } from "@/lib/util";
import { Bar, Card, Empty, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { n } = await searchParams;
  const span = Number(n ?? 12);
  const t = today();
  const toM = t.slice(0, 7);
  let fromM = addMonths(t, -(span - 1)).slice(0, 7);
  if (fromM < BOOKS_START.slice(0, 7)) fromM = BOOKS_START.slice(0, 7);
  const [rows, mix, props] = await Promise.all([monthly(fromM, toM), channelMix(fromM, toM), byProperty(fromM, toM)]);
  const cur = rows.find((r) => r.month === toM);
  const prev = rows.filter((r) => r.month < toM).slice(-3);
  const avg = (f: (k: ReturnType<typeof kpis>) => number) => (prev.length ? prev.map((r) => f(kpis(r))).reduce((a, b) => a + b, 0) / prev.length : 0);
  const ck = cur ? kpis(cur) : null;
  const arrow = (now: number, base: number) => (base ? (now >= base ? <span className="text-good">▲</span> : <span className="text-bad">▼</span>) : null);
  const maxNet = Math.max(REVENUE_TARGET, ...rows.map((r) => r.net));
  const totalNet = mix.reduce((s, m) => s + m.net, 0);
  const totalMonths = rows.length || 1;

  return (
    <div>
      <PageHeader eyebrow="Performance" title="Metrics">
        {[6, 12].map((x) => <a key={x} href={`/metrics?n=${x}`} className={`btn-sm ${span === x ? "border-rustic text-rustic" : ""}`}>{x} months</a>)}
      </PageHeader>

      {rows.every((r) => r.bookings + r.cancelled === 0) ? <Card><Empty>No bookings loaded yet. Go to Settings → Sync Hospitable (or import a CSV).</Empty></Card> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat label={`Occupancy · ${monthLabel(toM)}`} value={<>{pct(ck?.occupancy)} {ck && arrow(ck.occupancy, avg((k) => k.occupancy))}</>} sub={`3-mo avg ${pct(avg((k) => k.occupancy))} · target ${pct(OCCUPANCY_TARGET)}`} tone={ck && ck.occupancy >= OCCUPANCY_TARGET ? "good" : "warn"} />
            <Stat label="ADR (gross / night)" value={<>{peso(ck?.adr)} {ck && arrow(ck.adr, avg((k) => k.adr))}</>} sub={`3-mo avg ${peso(avg((k) => k.adr))}`} />
            <Stat label="Avg length of stay" value={<>{ck ? ck.los.toFixed(2) : "–"} {ck && arrow(ck.los, avg((k) => k.los))}</>} sub={`3-mo avg ${avg((k) => k.los).toFixed(2)} nights`} tone={ck && ck.los < 2 ? "bad" : undefined} />
            <Stat label="Direct share of revenue" value={pct(ck?.directShare)} sub="Goal: 15%+ to cut Airbnb risk" tone={ck && ck.directShare >= 0.15 ? "good" : "bad"} />
          </div>

          <Card title="Net revenue by month (check-in month)" className="mb-5">
            <div className="flex items-end gap-2 h-48">
              {rows.map((r) => (
                <div key={r.month} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${monthLabel(r.month)}: ${peso(r.net)}`}>
                  <div className="text-[10px] tabular-nums text-timber/60">{Math.round(r.net / 1000)}k</div>
                  <div className={`w-full rounded-t ${r.net >= REVENUE_TARGET ? "bg-good" : r.month === toM ? "bg-maple" : "bg-rustic"}`} style={{ height: `${(r.net / maxNet) * 80}%` }} />
                  <div className="text-[10px] text-timber/60">{monthLabel(r.month).slice(0, 3)}</div>
                </div>
              ))}
            </div>
            <div className="text-xs muted mt-2">Green = hit ₱{REVENUE_TARGET / 1000}k target. The current month only counts check-ins booked so far.</div>
          </Card>

          <Card title="Monthly KPIs" className="mb-5">
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Month</th><th className="num">Bookings</th><th className="num">Nights</th><th className="num">Occ.</th><th className="num">ADR</th><th className="num">RevPAN</th><th className="num">LOS</th><th className="num">Gross</th><th className="num">Fees</th><th className="num">Fee %</th><th className="num">Net</th><th className="num">Cancel %</th><th className="num">Direct</th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const k = kpis(r);
                    return (
                      <tr key={r.month}>
                        <td className="whitespace-nowrap">{monthLabel(r.month)}</td>
                        <td className="num">{r.bookings}</td><td className="num">{r.nights}</td>
                        <td className={`num ${k.occupancy >= OCCUPANCY_TARGET ? "text-good" : k.occupancy < 0.5 ? "text-bad" : ""}`}>{pct(k.occupancy)}</td>
                        <td className="num">{peso(k.adr)}</td><td className="num">{peso(k.revpan)}</td><td className="num">{k.los.toFixed(2)}</td>
                        <td className="num">{peso(r.gross)}</td><td className="num text-bad">{peso(r.fees)}</td><td className="num">{pct(k.feePct, 1)}</td>
                        <td className="num font-medium">{peso(r.net)}</td><td className="num">{pct(k.cancelRate)}</td><td className="num">{pct(k.directShare)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs muted mt-2">Occupancy = booked unit-nights ÷ ({PHYSICAL_UNITS} units × days). Twin Casa counts as 2 units. Hospitable&apos;s own % may use a different base.</p>
          </Card>

          <div className="grid md:grid-cols-2 gap-5">
            <Card title="Channel mix">
              <table className="tbl">
                <thead><tr><th>Channel</th><th className="num">Bookings</th><th className="num">Net</th><th className="num">Share</th><th className="num">Fee %</th></tr></thead>
                <tbody>
                  {mix.map((m) => (
                    <tr key={m.platform}>
                      <td>{CHANNEL_LABEL[m.platform] ?? m.platform}</td><td className="num">{m.bookings}</td><td className="num">{peso(m.net)}</td>
                      <td className="num">{pct(totalNet ? m.net / totalNet : 0)}</td><td className="num">{pct(m.gross ? m.fees / m.gross : 0, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mix[0] && totalNet && mix[0].net / totalNet > 0.8 && (
                <p className="text-xs text-bad mt-3">🚨 {CHANNEL_LABEL[mix[0].platform]} is {pct(mix[0].net / totalNet)} of revenue. One algorithm change away from a bad month.</p>
              )}
            </Card>
            <Card title="By unit">
              <table className="tbl">
                <thead><tr><th>Unit</th><th className="num">Nights</th><th className="num">Occ.</th><th className="num">Net</th><th className="num">Net / mo</th><th className="w-24"></th></tr></thead>
                <tbody>
                  {props.map((p) => {
                    const days = rows.reduce((s, r) => s + daysInMonth(r.month + "-01"), 0);
                    const occ = p.units === 2 ? null : days ? p.nights / days : 0;
                    return (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap">{p.name.replace("Casa de ", "")}</td><td className="num">{p.nights}</td>
                        <td className="num">{occ === null ? <span className="muted">combo</span> : pct(occ)}</td>
                        <td className="num">{peso(p.net)}</td><td className="num">{peso(p.net / totalMonths)}</td>
                        <td>{occ !== null && <Bar value={occ} max={1} tone={occ >= OCCUPANCY_TARGET ? "bg-good" : occ < 0.4 ? "bg-bad/70" : "bg-maple"} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs muted mt-2">Unit occupancy here leaves out nights blocked by Twin Casa bookings (Aurora and Olivia). The Calendar shows the combined view.</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
