import Link from "next/link";
import { occupancyGrid } from "@/lib/data";
import { addDays, CHANNEL_LABEL, fmtDay, OCCUPANCY_TARGET, pct, today } from "@/lib/util";
import { Card, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const COLORS: Record<string, string> = {
  airbnb: "bg-rustic text-linen",
  "booking.com": "bg-timber text-linen",
  agoda: "bg-maple text-timber",
  direct: "bg-good text-linen",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const t = today();
  const start = from ?? t;
  const days = 30;
  const g = await occupancyGrid(start, days);
  const weekend = (d: string) => [5, 6].includes(new Date(d + "T00:00:00Z").getUTCDay());
  const emptyWeekendNights = g.empty.filter((e) => weekend(e.date)).length;

  return (
    <div>
      <PageHeader eyebrow="Next 30 nights" title="Calendar">
        <Link href={`/calendar?from=${addDays(start, -30)}`} className="btn-ghost">←</Link>
        <Link href="/calendar" className="btn-ghost">Today</Link>
        <Link href={`/calendar?from=${addDays(start, 30)}`} className="btn-ghost">→</Link>
        <a href="https://my.hospitable.com/calendar" target="_blank" rel="noreferrer" className="btn">Open in Hospitable ↗</a>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Stat label="Occupancy (these 30 nights)" value={pct(g.occupancy)} tone={g.occupancy >= OCCUPANCY_TARGET ? "good" : g.occupancy >= 0.5 ? "warn" : "bad"} />
        <Stat label="Empty unit-nights" value={g.empty.length} />
        <Stat label="Empty Fri/Sat nights" value={emptyWeekendNights} sub="Weekends should sell first" tone={emptyWeekendNights > 6 ? "bad" : undefined} />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white z-10 text-left pr-3 py-1 font-medium text-timber/60 min-w-[120px]">Unit</th>
                {g.dates.map((d) => (
                  <th key={d} className={`px-0 py-1 font-normal text-center min-w-[30px] ${d === t ? "text-rustic font-semibold" : weekend(d) ? "text-timber" : "text-timber/50"}`}>
                    <div>{fmtDay(d).slice(0, 2)}</div>
                    <div>{d.slice(8)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.grid.map((row) => (
                <tr key={row.id}>
                  <td className="sticky left-0 bg-white z-10 pr-3 py-1 font-medium whitespace-nowrap">{row.name.replace("Casa de ", "")}</td>
                  {row.nights.map((n, i) => (
                    <td key={i} className="p-[1px]">
                      {n ? (
                        <div title={`${n.guest ?? n.code} · ${CHANNEL_LABEL[n.platform]}${n.viaTwin ? " · Twin Casa" : ""}`}
                          className={`h-7 rounded-sm flex items-center justify-center ${COLORS[n.platform] ?? "bg-timber/40"} ${n.viaTwin ? "opacity-75" : ""}`}>
                          {n.start ? "●" : ""}
                        </div>
                      ) : (
                        <div className={`h-7 rounded-sm border border-dashed ${weekend(g.dates[i]) ? "border-bad/40 bg-bad/5" : "border-timber/15"}`} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs">
          {Object.entries(COLORS).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${c}`} />{CHANNEL_LABEL[k]}</span>
          ))}
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm border border-dashed border-bad/40 bg-bad/5" />Empty weekend</span>
          <span className="muted">● = check-in · faded = Twin Casa booking</span>
        </div>
      </Card>
    </div>
  );
}
