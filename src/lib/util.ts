export const TZ = "Asia/Manila";

export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDays(d: string, n: number): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

export function monthStart(d: string): string {
  return d.slice(0, 7) + "-01";
}

export function monthEnd(d: string): string {
  const [y, m] = d.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${d.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

export function addMonths(d: string, n: number): string {
  const [y, m] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return dt.toISOString().slice(0, 10);
}

export function daysInMonth(d: string): number {
  return Number(monthEnd(d).slice(8, 10));
}

export function peso(n: number | null | undefined, opts: { decimals?: boolean } = {}): string {
  const v = Number(n ?? 0);
  const s = Math.abs(v).toLocaleString("en-PH", {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  });
  return (v < 0 ? "-₱" : "₱") + s;
}

export function pct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !isFinite(n)) return "–";
  return (n * 100).toFixed(digits) + "%";
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "–";
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function fmtDay(d: string): string {
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("en-PH", { weekday: "short", timeZone: "UTC" });
}

export function monthLabel(d: string): string {
  const dt = new Date(d.slice(0, 7) + "-01T00:00:00Z");
  return dt.toLocaleDateString("en-PH", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function num(v: unknown): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

export function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

export const CHANNELS = ["airbnb", "booking.com", "agoda", "direct"] as const;
export const CHANNEL_LABEL: Record<string, string> = {
  airbnb: "Airbnb",
  "booking.com": "Booking.com",
  agoda: "Agoda",
  direct: "Direct",
};

export const LEAD_SOURCES = ["WhatsApp", "Messenger", "Instagram", "TikTok", "Facebook", "Referral", "Repeat guest", "Other"];
export const LEAD_STATUSES = ["new", "quoted", "booked", "lost"] as const;
export const LOST_REASONS = ["Price", "Dates unavailable", "No reply", "Booked elsewhere", "Location", "Other"];

/** Roxanne's chart of accounts (Nov 2026). Direct = tied to a unit. Operational = shared across all units. */
export const EXPENSE_GROUPS: { group: string; hint: string; items: { name: string; icon: string; note?: string }[] }[] = [
  {
    group: "Direct costs",
    hint: "per unit",
    items: [
      { name: "Electricity", icon: "⚡" },
      { name: "Water", icon: "💧" },
      { name: "Internet", icon: "🌐", note: "all units" },
      { name: "Netflix", icon: "📺", note: "5 units × ₱549" },
      { name: "Disney+", icon: "🎬", note: "2 subs × ₱599" },
      { name: "Condo Dues", icon: "🏢", note: "7 units × ₱1,400 incl. office 413" },
      { name: "Maintenance & Repairs", icon: "🔧" },
    ],
  },
  {
    group: "Operational costs",
    hint: "shared across all units",
    items: [
      { name: "Cleaning Fee", icon: "🧹" },
      { name: "Laundry", icon: "👕" },
      { name: "Supplies", icon: "🛒" },
      { name: "Mini Bar", icon: "🍫" },
      { name: "Shopee", icon: "📦" },
      { name: "Mortgages", icon: "🏠", note: "305·315·316·415·420" },
      { name: "Office Rent", icon: "🏬", note: "413" },
      { name: "Hospitable", icon: "💻" },
      { name: "Operations Manager", icon: "👩‍💼" },
      { name: "Marketing & Ads", icon: "📱" },
      { name: "Legal & Permits", icon: "⚖️" },
    ],
  },
];
export const OWNER_DRAW = "Owner draw";
export const EXPENSE_CATEGORIES = [...EXPENSE_GROUPS.flatMap((g) => g.items.map((i) => i.name)), OWNER_DRAW];
// Not operating costs: excluded from operating profit (money you take out, e.g. transfers to your personal GCash)
export const NON_OPERATING = new Set([OWNER_DRAW]);
export const CATEGORY_ICON: Record<string, string> = Object.fromEntries(
  EXPENSE_GROUPS.flatMap((g) => g.items.map((i) => [i.name, i.icon])),
);
export function categoryGroup(c: string): string {
  if (c === OWNER_DRAW) return "Owner draw";
  return EXPENSE_GROUPS.find((g) => g.items.some((i) => i.name === c))?.group ?? "Other";
}

export const CONTENT_PLATFORMS = ["Instagram", "TikTok", "Facebook", "Stories"];
export const PILLARS = ["The Space", "Stay Experience", "Guest Love", "Cebu Life", "Behind the Brand", "Promotions & Offers"];
export const CONTENT_STATUSES = ["idea", "drafted", "scheduled", "posted"];

export const REVENUE_TARGET = 400000;
export const OCCUPANCY_TARGET = 0.75;
export const PHYSICAL_UNITS = 6;
export const BOOKS_START = "2026-01-01";
