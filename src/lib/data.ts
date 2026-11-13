import "server-only";
import { q } from "./db";
import { addDays, daysBetween, daysInMonth, monthEnd, num, PHYSICAL_UNITS, today, NON_OPERATING } from "./util";

/* ───────────── Reservations / KPIs ───────────── */

export type MonthRow = {
  month: string;
  bookings: number;
  nights: number;
  unit_nights: number;
  gross: number;
  fees: number;
  net: number;
  cancelled: number;
  cancelled_nights: number;
  cancel_income: number;
  direct_net: number;
};

/** Revenue accrued in check-in month (same rule as the books). */
export async function monthly(fromMonth: string, toMonth: string, platform?: string): Promise<MonthRow[]> {
  const rows = await q<Record<string, unknown>>(
    `SELECT substr(r.checkin,1,7) AS month,
      count(*) FILTER (WHERE r.status='accepted')::int AS bookings,
      COALESCE(sum(r.nights) FILTER (WHERE r.status='accepted'),0)::int AS nights,
      COALESCE(sum(r.nights*p.units) FILTER (WHERE r.status='accepted'),0)::int AS unit_nights,
      COALESCE(sum(r.gross) FILTER (WHERE r.status='accepted'),0)::float8 AS gross,
      COALESCE(sum(r.platform_fee) FILTER (WHERE r.status='accepted'),0)::float8 AS fees,
      COALESCE(sum(r.net_revenue) FILTER (WHERE r.status='accepted'),0)::float8 AS net,
      count(*) FILTER (WHERE r.status='cancelled')::int AS cancelled,
      COALESCE(sum(r.nights) FILTER (WHERE r.status='cancelled'),0)::int AS cancelled_nights,
      COALESCE(sum(r.net_revenue) FILTER (WHERE r.status='cancelled' AND r.net_revenue>0),0)::float8 AS cancel_income,
      COALESCE(sum(r.net_revenue) FILTER (WHERE r.status='accepted' AND r.platform='direct'),0)::float8 AS direct_net
     FROM reservations r JOIN properties p ON p.id=r.property_id
     WHERE substr(r.checkin,1,7) BETWEEN $1 AND $2 ${platform ? "AND r.platform=$3" : ""}
     GROUP BY 1 ORDER BY 1`,
    platform ? [fromMonth, toMonth, platform] : [fromMonth, toMonth],
  );
  const found = rows.map((r) => ({
    month: String(r.month),
    bookings: num(r.bookings),
    nights: num(r.nights),
    unit_nights: num(r.unit_nights),
    gross: num(r.gross),
    fees: num(r.fees),
    net: num(r.net),
    cancelled: num(r.cancelled),
    cancelled_nights: num(r.cancelled_nights),
    cancel_income: num(r.cancel_income),
    direct_net: num(r.direct_net),
  }));
  // Fill empty months with zeros so gaps are visible, not hidden
  const out: MonthRow[] = [];
  for (let m = fromMonth; m <= toMonth; ) {
    out.push(found.find((f) => f.month === m) ?? { month: m, bookings: 0, nights: 0, unit_nights: 0, gross: 0, fees: 0, net: 0, cancelled: 0, cancelled_nights: 0, cancel_income: 0, direct_net: 0 });
    const [y, mo] = m.split("-").map(Number);
    m = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
  }
  return out;
}

export function kpis(m: MonthRow) {
  const avail = PHYSICAL_UNITS * daysInMonth(m.month + "-01");
  return {
    occupancy: avail ? m.unit_nights / avail : 0,
    adr: m.nights ? m.gross / m.nights : 0,
    revpan: avail ? m.net / avail : 0,
    los: m.bookings ? m.nights / m.bookings : 0,
    feePct: m.gross ? m.fees / m.gross : 0,
    cancelRate: m.bookings + m.cancelled ? m.cancelled / (m.bookings + m.cancelled) : 0,
    directShare: m.net ? m.direct_net / m.net : 0,
  };
}

export async function channelMix(fromMonth: string, toMonth: string) {
  return q<{ platform: string; bookings: number; nights: number; gross: number; fees: number; net: number }>(
    `SELECT platform, count(*)::int AS bookings, sum(nights)::int AS nights, sum(gross)::float8 AS gross,
       sum(platform_fee)::float8 AS fees, sum(net_revenue)::float8 AS net
     FROM reservations WHERE status='accepted' AND substr(checkin,1,7) BETWEEN $1 AND $2
     GROUP BY platform ORDER BY net DESC`,
    [fromMonth, toMonth],
  );
}

export async function byProperty(fromMonth: string, toMonth: string) {
  return q<{ id: number; name: string; units: number; bookings: number; nights: number; net: number; gross: number }>(
    `SELECT p.id, p.name, p.units, count(r.code)::int AS bookings, COALESCE(sum(r.nights),0)::int AS nights,
       COALESCE(sum(r.net_revenue),0)::float8 AS net, COALESCE(sum(r.gross),0)::float8 AS gross
     FROM properties p LEFT JOIN reservations r ON r.property_id=p.id AND r.status='accepted'
       AND substr(r.checkin,1,7) BETWEEN $1 AND $2
     GROUP BY p.id, p.name, p.units, p.sort ORDER BY p.sort`,
    [fromMonth, toMonth],
  );
}

export type Res = {
  code: string;
  property_id: number;
  property: string;
  platform: string;
  status: string;
  checkin: string;
  checkout: string;
  nights: number;
  guests: number;
  guest_name: string | null;
  net_revenue: number;
  gross: number;
};

export async function reservationsOverlapping(start: string, end: string): Promise<Res[]> {
  return q<Res>(
    `SELECT r.code, r.property_id, p.name AS property, r.platform, r.status, r.checkin, r.checkout, r.nights, r.guests,
       r.guest_name, r.net_revenue::float8 AS net_revenue, r.gross::float8 AS gross
     FROM reservations r JOIN properties p ON p.id=r.property_id
     WHERE r.status='accepted' AND r.checkin < $2 AND r.checkout > $1 ORDER BY r.checkin`,
    [start, end],
  );
}

/** Night-by-night grid for the physical units. Twin Casa occupies Aurora + Olivia. */
export async function occupancyGrid(start: string, days: number) {
  const end = addDays(start, days);
  const props = await q<{ id: number; name: string; is_combo: boolean; keyword: string }>(
    `SELECT id, name, is_combo, keyword FROM properties ORDER BY sort`,
  );
  const res = await reservationsOverlapping(start, end);
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const physical = props.filter((p) => !p.is_combo);
  const combo = props.find((p) => p.is_combo);
  const grid = physical.map((p) => ({
    id: p.id,
    name: p.name,
    nights: dates.map(() => null as null | { code: string; platform: string; guest: string | null; start: boolean; viaTwin: boolean }),
  }));
  for (const r of res) {
    const targets =
      combo && r.property_id === combo.id
        ? grid.filter((g) => /aurora|olivia/i.test(g.name))
        : grid.filter((g) => g.id === r.property_id);
    dates.forEach((d, i) => {
      if (d >= r.checkin && d < r.checkout) {
        for (const t of targets)
          t.nights[i] = { code: r.code, platform: r.platform, guest: r.guest_name, start: d === r.checkin, viaTwin: targets.length > 1 };
      }
    });
  }
  const totalSlots = grid.length * days;
  const booked = grid.reduce((s, g) => s + g.nights.filter(Boolean).length, 0);
  const empty = grid.flatMap((g) => g.nights.map((n, i) => (n ? null : { property: g.name, date: dates[i] })).filter(Boolean)) as {
    property: string;
    date: string;
  }[];
  return { dates, grid, occupancy: totalSlots ? booked / totalSlots : 0, empty };
}

/* ───────────── Money ───────────── */

export type Bill = {
  id: number;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  day: number;
  property_id: number | null;
  account_id: number | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
  notes: string | null;
};

export async function getBills(): Promise<Bill[]> {
  return q<Bill>(`SELECT id, name, category, amount::float8 AS amount, frequency, day, property_id, account_id, start_date, end_date, active, notes
    FROM bills ORDER BY active DESC, day, name`);
}

/** frequency: monthly (day = day of month) | weekly (day = 1 Mon … 7 Sun) | once (start_date is the due date) */
export function billOccurrences(b: Bill, from: string, to: string): string[] {
  const out: string[] = [];
  if (!b.active) return out;
  const lo = from > b.start_date ? from : b.start_date;
  const hi = b.end_date && b.end_date < to ? b.end_date : to;
  if (b.frequency === "once") {
    if (b.start_date >= from && b.start_date <= to) out.push(b.start_date);
    return out;
  }
  if (b.frequency === "weekly") {
    for (let d = lo; d <= hi; d = addDays(d, 1)) {
      const wd = new Date(d + "T00:00:00Z").getUTCDay() || 7;
      if (wd === b.day) out.push(d);
    }
    return out;
  }
  let m = lo.slice(0, 7) + "-01";
  while (m <= hi) {
    const last = Number(monthEnd(m).slice(8));
    const d = `${m.slice(0, 7)}-${String(Math.min(b.day, last)).padStart(2, "0")}`;
    if (d >= lo && d <= hi) out.push(d);
    const [y, mo] = m.split("-").map(Number);
    m = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
  }
  return out;
}

export async function billSchedule(from: string, to: string) {
  const bills = await getBills();
  const paid = await q<{ bill_id: number; due_date: string; paid_date: string; amount: number }>(
    `SELECT bill_id, due_date, paid_date, amount::float8 AS amount FROM bill_payments WHERE due_date BETWEEN $1 AND $2`,
    [from, to],
  );
  const key = (id: number, d: string) => `${id}|${d}`;
  const paidMap = new Map(paid.map((p) => [key(p.bill_id, p.due_date), p]));
  const items = bills.flatMap((b) =>
    billOccurrences(b, from, to).map((d) => ({ bill: b, due: d, paid: paidMap.get(key(b.id, d)) ?? null })),
  );
  return items.sort((a, b) => a.due.localeCompare(b.due));
}

export async function cashPosition() {
  const rows = await q<{ id: number; name: string; kind: string; opening_balance: number; last_date: string | null; last_balance: number | null }>(
    `SELECT a.id, a.name, a.kind, a.opening_balance::float8 AS opening_balance, bc.date AS last_date, bc.balance::float8 AS last_balance
     FROM accounts a LEFT JOIN LATERAL (
       SELECT date, balance FROM balance_checks WHERE account_id=a.id ORDER BY date DESC LIMIT 1) bc ON true
     ORDER BY a.id`,
  );
  const accounts = rows.map((r) => ({ ...r, balance: r.last_balance ?? r.opening_balance }));
  const total = accounts.reduce((s, a) => s + num(a.balance), 0);
  const oldest = accounts.map((a) => a.last_date).filter(Boolean).sort()[0] ?? null;
  return { accounts, total, oldestCheck: oldest };
}

export type GuestPayment = {
  id: number;
  guest_name: string;
  reservation_code: string | null;
  lead_id: number | null;
  kind: string;
  method: string;
  amount: number;
  due_date: string | null;
  received_date: string | null;
  reference_no: string | null;
  account_id: number | null;
  notes: string | null;
};

export async function guestPayments(onlyOpen = false): Promise<GuestPayment[]> {
  return q<GuestPayment>(
    `SELECT id, guest_name, reservation_code, lead_id, kind, method, amount::float8 AS amount, due_date, received_date, reference_no, account_id, notes
     FROM guest_payments ${onlyOpen ? "WHERE received_date IS NULL" : ""}
     ORDER BY (received_date IS NULL) DESC, COALESCE(due_date, received_date) DESC NULLS LAST, id DESC LIMIT 300`,
  );
}

/** 13-week forecast from today's checked cash. Conservative: only bookings already on the books. */
export async function cashForecast(days = 91) {
  const t = today();
  const end = addDays(t, days);
  const pos = await cashPosition();
  const inflowRes = await q<{ d: string; amount: number; platform: string; code: string }>(
    `SELECT expected_cash_date AS d, net_revenue::float8 AS amount, platform, code FROM reservations
     WHERE status='accepted' AND platform<>'direct' AND actual_cash_date IS NULL
       AND expected_cash_date > $1 AND expected_cash_date <= $2`,
    [t, end],
  );
  const gp = await q<{ d: string; amount: number; kind: string; guest_name: string }>(
    `SELECT COALESCE(due_date,$1) AS d, amount::float8 AS amount, kind, guest_name FROM guest_payments
     WHERE received_date IS NULL AND COALESCE(due_date,$1) <= $2`,
    [t, end],
  );
  const sched = await billSchedule(addDays(t, -60), end);
  const unpaid = sched.filter((s) => !s.paid);
  const events: { d: string; amount: number; label: string }[] = [];
  for (const r of inflowRes) events.push({ d: r.d, amount: r.amount, label: `Payout ${r.platform} ${r.code}` });
  for (const g of gp) {
    const out = g.kind === "refund" || g.kind === "deposit_return";
    events.push({ d: g.d < t ? t : g.d, amount: out ? -g.amount : g.amount, label: `${out ? "Return to" : "From"} ${g.guest_name}` });
  }
  for (const s of unpaid) events.push({ d: s.due < t ? t : s.due, amount: -s.bill.amount, label: s.bill.name });

  const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, i) => {
    const ws = addDays(t, i * 7);
    const we = addDays(ws, 6);
    const ev = events.filter((e) => e.d >= ws && e.d <= we);
    return {
      start: ws,
      inflow: ev.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0),
      outflow: -ev.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0),
      events: ev,
    };
  });
  let bal = pos.total;
  let low = { balance: bal, week: t };
  const withBal = weeks.map((w) => {
    bal += w.inflow - w.outflow;
    if (bal < low.balance) low = { balance: bal, week: w.start };
    return { ...w, closing: bal };
  });
  const horizon = (n: number) => {
    const until = addDays(t, n);
    const ev = events.filter((e) => e.d <= until);
    const inflow = ev.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const outflow = -ev.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    return { inflow, outflow, closing: pos.total + inflow - outflow };
  };
  return { start: pos.total, weeks: withBal, low, h30: horizon(30), h60: horizon(60), h90: horizon(90), overdueBills: unpaid.filter((s) => s.due < t) };
}

export async function expensesByMonth(fromMonth: string, toMonth: string) {
  return q<{ month: string; category: string; amount: number }>(
    `SELECT substr(date,1,7) AS month, category, sum(amount)::float8 AS amount FROM expenses
     WHERE substr(date,1,7) BETWEEN $1 AND $2 GROUP BY 1,2 ORDER BY 1,2`,
    [fromMonth, toMonth],
  );
}

export async function pnl(fromMonth: string, toMonth: string) {
  const months = await monthly(fromMonth, toMonth);
  const chan = await q<{ month: string; platform: string; gross: number; fees: number; net: number }>(
    `SELECT substr(checkin,1,7) AS month, platform, sum(gross)::float8 AS gross, sum(platform_fee)::float8 AS fees, sum(net_revenue)::float8 AS net
     FROM reservations WHERE status='accepted' AND substr(checkin,1,7) BETWEEN $1 AND $2 GROUP BY 1,2`,
    [fromMonth, toMonth],
  );
  const exp = await expensesByMonth(fromMonth, toMonth);
  const list: string[] = [];
  for (let m = fromMonth; m <= toMonth; ) {
    list.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
  }
  const cats = Array.from(new Set(exp.map((e) => e.category))).sort();
  return list.map((m) => {
    const mr = months.find((x) => x.month === m);
    const ch = chan.filter((c) => c.month === m);
    const ex = exp.filter((e) => e.month === m);
    const opex = ex.filter((e) => !NON_OPERATING.has(e.category)).reduce((s, e) => s + e.amount, 0);
    const draws = ex.filter((e) => NON_OPERATING.has(e.category)).reduce((s, e) => s + e.amount, 0);
    const net = (mr?.net ?? 0) + (mr?.cancel_income ?? 0);
    return {
      month: m,
      byChannel: Object.fromEntries(ch.map((c) => [c.platform, c])),
      gross: mr?.gross ?? 0,
      fees: mr?.fees ?? 0,
      cancelIncome: mr?.cancel_income ?? 0,
      netRevenue: net,
      expenses: Object.fromEntries(cats.map((c) => [c, ex.find((e) => e.category === c)?.amount ?? 0])),
      opex,
      draws,
      operatingProfit: net - opex,
      margin: net ? (net - opex) / net : 0,
      cats,
    };
  });
}

/* ───────────── Leads ───────────── */

export type Lead = {
  id: number;
  created_on: string;
  source: string;
  name: string;
  contact: string | null;
  checkin: string | null;
  checkout: string | null;
  guests: number | null;
  property_interest: string | null;
  quote: number | null;
  status: string;
  lost_reason: string | null;
  follow_up: string | null;
  notes: string | null;
};

export async function getLeads(status?: string): Promise<Lead[]> {
  return q<Lead>(
    `SELECT id, created_on, source, name, contact, checkin, checkout, guests, property_interest, quote::float8 AS quote, status, lost_reason, follow_up, notes
     FROM leads ${status ? "WHERE status=$1" : ""} ORDER BY
       CASE status WHEN 'new' THEN 0 WHEN 'quoted' THEN 1 WHEN 'booked' THEN 2 ELSE 3 END, COALESCE(follow_up, created_on), id DESC`,
    status ? [status] : [],
  );
}

export async function leadStats(fromDate: string) {
  const rows = await q<{ source: string; status: string; n: number; value: number }>(
    `SELECT source, status, count(*)::int AS n, COALESCE(sum(quote),0)::float8 AS value FROM leads WHERE created_on >= $1 GROUP BY 1,2`,
    [fromDate],
  );
  const sources = Array.from(new Set(rows.map((r) => r.source)));
  const bySource = sources.map((s) => {
    const r = rows.filter((x) => x.source === s);
    const total = r.reduce((a, b) => a + b.n, 0);
    const booked = r.find((x) => x.status === "booked");
    return { source: s, total, booked: booked?.n ?? 0, bookedValue: booked?.value ?? 0, rate: total ? (booked?.n ?? 0) / total : 0 };
  });
  const total = bySource.reduce((a, b) => a + b.total, 0);
  const booked = bySource.reduce((a, b) => a + b.booked, 0);
  const lost = await q<{ lost_reason: string; n: number }>(
    `SELECT COALESCE(lost_reason,'(no reason)') AS lost_reason, count(*)::int AS n FROM leads WHERE status='lost' AND created_on >= $1 GROUP BY 1 ORDER BY 2 DESC`,
    [fromDate],
  );
  return { bySource: bySource.sort((a, b) => b.total - a.total), total, booked, rate: total ? booked / total : 0, lost };
}

/* ───────────── Guests ───────────── */

export async function repeatGuests() {
  return q<{ guest_name: string; stays: number; nights: number; net: number; last_stay: string; properties: string }>(
    `SELECT r.guest_name, count(*)::int AS stays, sum(r.nights)::int AS nights, sum(r.net_revenue)::float8 AS net, max(r.checkin) AS last_stay,
       string_agg(DISTINCT p.name, ', ') AS properties
     FROM reservations r JOIN properties p ON p.id=r.property_id
     WHERE r.status='accepted' AND r.guest_name IS NOT NULL AND r.guest_name <> ''
     GROUP BY r.guest_name ORDER BY count(*) DESC, max(r.checkin) DESC LIMIT 200`,
  );
}

export function weeksAgo(d: string) {
  return Math.floor(daysBetween(d, today()) / 7);
}
