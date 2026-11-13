import { repeatGuests } from "@/lib/data";
import { fetchOpenReviews } from "@/lib/reviews";
import { fmtDate, peso } from "@/lib/util";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const [guests, reviews] = await Promise.all([repeatGuests(), fetchOpenReviews()]);
  const repeat = guests.filter((g) => g.stays >= 2);

  return (
    <div>
      <PageHeader eyebrow="Reviews & repeat guests" title="Guests">
        <a href="https://my.hospitable.com/reviews" target="_blank" rel="noreferrer" className="btn-ghost">Reviews in Hospitable ↗</a>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Stat label="Reviews waiting for a reply" value={reviews.ok ? reviews.items.length : "–"} sub={reviews.ok ? "Reply within 48h" : reviews.error} tone={reviews.ok && reviews.items.length ? "warn" : undefined} />
        <Stat label="Repeat guests" value={repeat.length} sub="Stayed 2+ times" />
        <Stat label="Repeat guest revenue" value={peso(repeat.reduce((s, g) => s + g.net, 0))} sub="Your cheapest bookings to win back" />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Card title="Reviews to answer">
          {!reviews.ok ? <Empty>{reviews.error}</Empty> : reviews.items.length === 0 ? <Empty>All reviews answered.</Empty> : (
            <ul className="space-y-3">
              {reviews.items.map((r) => (
                <li key={r.id} className="text-sm border-b border-timber/5 pb-3">
                  <div className="flex justify-between"><span className="font-medium">{r.guest} <span className="muted font-normal">· {r.property}</span></span><span className={r.rating && r.rating < 5 ? "text-bad" : "text-good"}>{r.rating ? "★".repeat(Math.round(r.rating)) : ""}</span></div>
                  <p className="muted mt-1 line-clamp-3">{r.text}</p>
                  <div className="text-xs muted mt-1">{fmtDate(r.date)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Win-back list">
          {guests.length === 0 ? <Empty>Guest names come from the Hospitable sync. CSV imports don&apos;t include names.</Empty> : (
            <table className="tbl">
              <thead><tr><th>Guest</th><th className="num">Stays</th><th>Last stay</th><th className="num">Spent</th></tr></thead>
              <tbody>
                {guests.slice(0, 40).map((g) => (
                  <tr key={g.guest_name}>
                    <td>{g.guest_name}<span className="block text-xs muted">{g.properties}</span></td>
                    <td className="num">{g.stays}</td><td>{fmtDate(g.last_stay)}</td><td className="num">{peso(g.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs muted mt-3">Message past guests before holidays and long weekends with a direct-booking rate. That turns one Airbnb guest into a fee-free repeat booking.</p>
        </Card>
      </div>
    </div>
  );
}
