import "server-only";
import Papa from "papaparse";
import { q, one } from "./db";
import { addDays, BOOKS_START, today } from "./util";

export type Property = {
  id: number;
  name: string;
  code: string | null;
  keyword: string | null;
  units: number;
  is_combo: boolean;
  hospitable_id: string | null;
  csv_property_id: string | null;
  sort: number;
};

export async function getProperties(): Promise<Property[]> {
  return q<Property>(`SELECT * FROM properties ORDER BY sort, id`);
}

export function normalizePlatform(p: string | null | undefined): string {
  const s = (p ?? "").toLowerCase().trim();
  if (s.includes("airbnb")) return "airbnb";
  if (s.includes("booking")) return "booking.com";
  if (s.includes("agoda")) return "agoda";
  return "direct"; // manual, direct, website, homeaway etc.
}

/** Expected payout date rules (editable later): Airbnb = check-in + 1, OTAs = checkout, Direct = check-in */
export function expectedCashDate(platform: string, checkin: string, checkout: string): string {
  if (platform === "airbnb") return addDays(checkin, 1);
  if (platform === "booking.com" || platform === "agoda") return checkout;
  return checkin;
}

function matchProperty(props: Property[], name: string, extId?: string | null, kind: "csv" | "hosp" = "csv") {
  if (extId) {
    const byId = props.find((p) => (kind === "csv" ? p.csv_property_id : p.hospitable_id) === extId);
    if (byId) return byId;
  }
  const n = name.toLowerCase();
  // Twin first so "Twin Casa (Aurora + Olivia)" doesn't match Aurora
  const sorted = [...props].sort((a, b) => Number(b.is_combo) - Number(a.is_combo));
  return sorted.find((p) => p.keyword && n.includes(p.keyword)) ?? sorted.find((p) => p.code && n.startsWith(p.code + " "));
}

type Upsert = {
  code: string;
  hospitable_id?: string | null;
  property_id: number;
  platform: string;
  status: string;
  checkin: string;
  checkout: string;
  nights: number;
  guests: number;
  pets: number;
  guest_name?: string | null;
  gross: number;
  platform_fee: number;
  net_revenue: number;
  adjustments: number;
  source: string;
  raw: unknown;
};

async function upsertReservation(r: Upsert): Promise<"inserted" | "updated"> {
  const existing = await one<{ code: string }>(`SELECT code FROM reservations WHERE code=$1`, [r.code]);
  const ecd = expectedCashDate(r.platform, r.checkin, r.checkout);
  if (existing) {
    await q(
      `UPDATE reservations SET hospitable_id=COALESCE($2,hospitable_id), property_id=$3, platform=$4, status=$5, checkin=$6, checkout=$7,
        nights=$8, guests=$9, pets=$10, guest_name=COALESCE($11,guest_name), gross=$12, platform_fee=$13, net_revenue=$14, adjustments=$15,
        expected_cash_date=$16, source=$17, raw=$18, updated_at=now() WHERE code=$1`,
      [r.code, r.hospitable_id ?? null, r.property_id, r.platform, r.status, r.checkin, r.checkout, r.nights, r.guests, r.pets,
        r.guest_name ?? null, r.gross, r.platform_fee, r.net_revenue, r.adjustments, ecd, r.source, JSON.stringify(r.raw)],
    );
    return "updated";
  }
  await q(
    `INSERT INTO reservations (code, hospitable_id, property_id, platform, status, checkin, checkout, nights, guests, pets, guest_name,
      gross, platform_fee, net_revenue, adjustments, expected_cash_date, source, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [r.code, r.hospitable_id ?? null, r.property_id, r.platform, r.status, r.checkin, r.checkout, r.nights, r.guests, r.pets,
      r.guest_name ?? null, r.gross, r.platform_fee, r.net_revenue, r.adjustments, ecd, r.source, JSON.stringify(r.raw)],
  );
  return "inserted";
}

const REQUIRED_COLS = ["checkin_date", "checkout_date", "code", "platform", "property_name", "status", "nights", "host_service_fee", "revenue"];

/** Hospitable "Reservations & Financials" CSV export (31 columns). Upserts by code. */
export async function importCsv(text: string) {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
  const cols = parsed.meta.fields ?? [];
  const missing = REQUIRED_COLS.filter((c) => !cols.includes(c));
  if (missing.length) throw new Error(`CSV is missing columns: ${missing.join(", ")}`);
  const props = await getProperties();
  const res = { read: 0, inserted: 0, updated: 0, ignored: 0, unmapped: [] as string[], latest: "" };
  for (const row of parsed.data) {
    res.read++;
    const checkin = (row.checkin_date || "").slice(0, 10);
    if (!checkin || checkin < BOOKS_START) {
      res.ignored++;
      continue;
    }
    const prop = matchProperty(props, row.property_name || "", row.property_id, "csv");
    if (!prop) {
      if (!res.unmapped.includes(row.property_name)) res.unmapped.push(row.property_name);
      continue;
    }
    if (row.property_id && !prop.csv_property_id) {
      await q(`UPDATE properties SET csv_property_id=$1 WHERE id=$2`, [row.property_id, prop.id]);
      prop.csv_property_id = row.property_id;
    }
    const n = (k: string) => Number(row[k] || 0) || 0;
    const fee = n("host_service_fee");
    const net = n("revenue");
    const status = (row.status || "").toLowerCase().includes("cancel") ? "cancelled" : "accepted";
    const r = await upsertReservation({
      code: row.code,
      property_id: prop.id,
      platform: normalizePlatform(row.platform),
      status,
      checkin,
      checkout: (row.checkout_date || "").slice(0, 10),
      nights: n("nights"),
      guests: n("guest_count"),
      pets: n("guests_pets"),
      gross: net + fee,
      platform_fee: fee,
      net_revenue: net,
      adjustments: n("adjusted_amount"),
      source: "csv",
      raw: row,
    });
    res[r]++;
    if (checkin > res.latest) res.latest = checkin;
  }
  await q(`INSERT INTO sync_log (source, summary, ok) VALUES ('csv', $1, $2)`, [
    `Read ${res.read} · added ${res.inserted} · updated ${res.updated} · skipped pre-2026 ${res.ignored}` +
      (res.unmapped.length ? ` · UNMAPPED: ${res.unmapped.join(", ")}` : ""),
    res.unmapped.length === 0,
  ]);
  return res;
}

/* ───────────── Hospitable Public API v2 ───────────── */

const API = "https://public.api.hospitable.com/v2";

async function hosp<T = unknown>(path: string): Promise<T> {
  const token = process.env.HOSPITABLE_TOKEN;
  if (!token) throw new Error("HOSPITABLE_TOKEN is not set. Add it in Vercel → Settings → Environment Variables.");
  const r = await fetch(API + path, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Hospitable ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as T;
}

type Paged<T> = { data: T[]; meta?: { current_page?: number; last_page?: number }; links?: { next?: string | null } };

async function hospAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 50; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await hosp<Paged<T>>(`${path}${sep}page=${page}&per_page=100`);
    out.push(...(res.data ?? []));
    const last = res.meta?.last_page;
    if (last ? page >= last : !res.links?.next) break;
  }
  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const amt = (x: any): number => {
  if (x == null) return 0;
  if (typeof x === "number") return x / 100;
  if (typeof x.amount === "number") return x.amount / 100;
  return 0;
};
const sumAmt = (arr: any): number => (Array.isArray(arr) ? arr.reduce((s, i) => s + amt(i), 0) : 0);

export function mapHospitableFinancials(res: any) {
  const host = res?.financials?.host ?? {};
  const net = amt(host.revenue);
  // host_fees are negative line items (platform/host service fee)
  const fee = Math.abs(sumAmt(host.host_fees ?? host.hostFees));
  const adjustments = sumAmt(host.adjustments);
  return { net, fee, gross: net + fee, adjustments };
}

export async function syncHospitable() {
  const props = await getProperties();
  const hProps = await hospAll<any>(`/properties`);
  const unmapped: string[] = [];
  for (const hp of hProps) {
    const name = hp.name || hp.public_name || "";
    const p = matchProperty(props, name, hp.id, "hosp");
    if (!p) {
      unmapped.push(name);
      continue;
    }
    if (p.hospitable_id !== hp.id) {
      await q(`UPDATE properties SET hospitable_id=$1 WHERE id=$2`, [hp.id, p.id]);
      p.hospitable_id = hp.id;
    }
  }
  const mapped = props.filter((p) => p.hospitable_id);
  if (!mapped.length) throw new Error("No Hospitable properties matched. Check property names in Settings.");
  const ids = mapped.map((p) => `properties[]=${encodeURIComponent(p.hospitable_id!)}`).join("&");
  const end = addDays(today(), 365);
  const list = await hospAll<any>(
    `/reservations?${ids}&start_date=${BOOKS_START}&end_date=${end}&include=financials,guest,properties`,
  );
  const res = { fetched: list.length, inserted: 0, updated: 0, skipped: 0 };
  for (const r of list) {
    const hid = r.properties?.[0]?.id ?? r.property_id ?? r.property?.id;
    const prop = mapped.find((p) => p.hospitable_id === hid);
    const checkin = String(r.arrival_date ?? r.check_in ?? "").slice(0, 10);
    const checkout = String(r.departure_date ?? r.check_out ?? "").slice(0, 10);
    if (!prop || !checkin) {
      res.skipped++;
      continue;
    }
    const cat = String(r.reservation_status?.current?.category ?? r.status ?? "").toLowerCase();
    if (["request", "not_accepted", "inquiry", "checkpoint"].includes(cat)) {
      res.skipped++;
      continue;
    }
    const status = cat.includes("cancel") || cat.includes("declined") ? "cancelled" : "accepted";
    const f = mapHospitableFinancials(r);
    const guestName = [r.guest?.first_name, r.guest?.last_name].filter(Boolean).join(" ") || null;
    const out = await upsertReservation({
      code: r.code || r.platform_id || r.id,
      hospitable_id: r.id,
      property_id: prop.id,
      platform: normalizePlatform(r.platform),
      status,
      checkin,
      checkout,
      nights: Number(r.nights ?? 0),
      guests: Number(r.guests?.total ?? 0),
      pets: Number(r.guests?.pet_count ?? 0),
      guest_name: guestName,
      gross: f.gross,
      platform_fee: f.fee,
      net_revenue: f.net,
      adjustments: f.adjustments,
      source: "hospitable",
      raw: { id: r.id, platform: r.platform, financials: r.financials, status: r.reservation_status ?? r.status },
    });
    res[out]++;
  }
  await q(`INSERT INTO sync_log (source, summary, ok) VALUES ('hospitable', $1, $2)`, [
    `Fetched ${res.fetched} · added ${res.inserted} · updated ${res.updated} · skipped ${res.skipped}` +
      (unmapped.length ? ` · unmatched listings: ${unmapped.join(", ")}` : ""),
    true,
  ]);
  return { ...res, unmapped };
}
