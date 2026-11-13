import { pnl } from "@/lib/data";
import { CHANNEL_LABEL, CHANNELS, monthLabel, peso, pct, today } from "@/lib/util";
import { Card, PageHeader } from "@/components/ui";
import { MoneyTabs } from "../tabs";

export const dynamic = "force-dynamic";

export default async function PnlPage({ searchParams }: { searchParams: Promise<{ y?: string }> }) {
  const { y } = await searchParams;
  const year = y ?? today().slice(0, 4);
  const toMonth = year === today().slice(0, 4) ? today().slice(0, 7) : `${year}-12`;
  const rows = await pnl(`${year}-01`, toMonth);
  const cats = rows[0]?.cats ?? [];
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const Row = ({ label, get, bold, tone, fmt = peso }: { label: string; get: (r: (typeof rows)[number]) => number; bold?: boolean; tone?: string; fmt?: (n: number) => string }) => (
    <tr className={bold ? "font-semibold bg-linen/60" : ""}>
      <td className={`sticky left-0 bg-white whitespace-nowrap ${bold ? "bg-linen" : ""}`}>{label}</td>
      {rows.map((r) => <td key={r.month} className={`num ${tone ?? ""}`}>{fmt(get(r))}</td>)}
      <td className={`num ${tone ?? ""} font-semibold`}>{fmt === pct ? pct(sum((r) => r.operatingProfit) / (sum((r) => r.netRevenue) || 1)) : fmt(sum(get))}</td>
    </tr>
  );

  return (
    <div>
      <PageHeader eyebrow="Money" title={`Profit & loss ${year}`}>
        {["2026", "2027"].map((yy) => <a key={yy} href={`/money/pnl?y=${yy}`} className={`btn-sm ${yy === year ? "border-rustic text-rustic" : ""}`}>{yy}</a>)}
      </PageHeader>
      <MoneyTabs current="/money/pnl" />
      <Card>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr><th className="sticky left-0 bg-white">Line</th>{rows.map((r) => <th key={r.month} className="num">{monthLabel(r.month).replace(" 20", " '")}</th>)}<th className="num">YTD</th></tr>
            </thead>
            <tbody>
              {CHANNELS.map((c) => <Row key={c} label={`Gross · ${CHANNEL_LABEL[c]}`} get={(r) => r.byChannel[c]?.gross ?? 0} />)}
              <Row label="Gross revenue" get={(r) => r.gross} bold />
              {CHANNELS.filter((c) => c !== "direct").map((c) => <Row key={c} label={`Platform fee · ${CHANNEL_LABEL[c]}`} get={(r) => -(r.byChannel[c]?.fees ?? 0)} tone="text-bad" />)}
              <Row label="Cancellation income" get={(r) => r.cancelIncome} />
              <Row label="Net revenue" get={(r) => r.netRevenue} bold />
              {cats.filter((c) => c !== "Owner draw").map((c) => <Row key={c} label={c} get={(r) => -(r.expenses[c] ?? 0)} tone="text-timber/80" />)}
              <Row label="Operating expenses" get={(r) => -r.opex} bold tone="text-bad" />
              <Row label="Operating profit" get={(r) => r.operatingProfit} bold tone="text-good" />
              <Row label="Margin" get={(r) => r.margin} fmt={pct} />
              <Row label="Owner draws" get={(r) => -r.draws} />
            </tbody>
          </table>
        </div>
        <p className="text-xs muted mt-3">
          Revenue counts in the check-in month. Expenses count on the date paid. Platform fee = host service fee each channel keeps.
          This is your management P&L, not BIR books. Give your CPA the Expenses export.
        </p>
      </Card>
    </div>
  );
}
