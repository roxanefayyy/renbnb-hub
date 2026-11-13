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

export const EXPENSE_CATEGORIES = [
  "Housekeeping labor",
  "Laundry & linen",
  "Guest supplies",
  "Salaries (Rhea/staff)",
  "Amortization / rent",
  "Association dues",
  "Electricity",
  "Water",
  "Internet",
  "Streaming",
  "Repairs & maintenance",
  "Pest control",
  "Software / channel manager",
  "Marketing & content",
  "Professional fees",
  "Permits & taxes",
  "Bank / payment fees",
  "Loan interest",
  "Transport",
  "Owner draw",
  "Miscellaneous",
];
// Not operating costs: excluded from operating profit
export const NON_OPERATING = new Set(["Owner draw"]);

export const CONTENT_PLATFORMS = ["Instagram", "TikTok", "Facebook", "Stories"];
export const PILLARS = ["The Space", "Stay Experience", "Guest Love", "Cebu Life", "Behind the Brand", "Promotions & Offers"];
export const CONTENT_STATUSES = ["idea", "drafted", "scheduled", "posted"];

export const REVENUE_TARGET = 400000;
export const OCCUPANCY_TARGET = 0.75;
export const PHYSICAL_UNITS = 6;
export const BOOKS_START = "2026-01-01";
