import "server-only";
import { q } from "./db";

export type OpenReview = { id: string; guest: string; property: string; rating: number | null; text: string; date: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchOpenReviews(): Promise<{ ok: true; items: OpenReview[] } | { ok: false; error: string; items: [] }> {
  const token = process.env.HOSPITABLE_TOKEN;
  if (!token) return { ok: false, error: "Connect Hospitable (add HOSPITABLE_TOKEN) to see reviews here.", items: [] };
  const props = await q<{ name: string; hospitable_id: string }>(`SELECT name, hospitable_id FROM properties WHERE hospitable_id IS NOT NULL`);
  if (!props.length) return { ok: false, error: "Run a Hospitable sync first (Settings).", items: [] };
  try {
    const all = await Promise.all(
      props.map(async (p) => {
        const r = await fetch(
          `https://public.api.hospitable.com/v2/properties/${p.hospitable_id}/reviews?responded=false&include=guest&per_page=20`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, next: { revalidate: 3600 } },
        );
        if (!r.ok) throw new Error(`Hospitable ${r.status}`);
        const j = await r.json();
        return (j.data ?? []).map((x: any) => ({
          id: String(x.id),
          guest: [x.guest?.first_name, x.guest?.last_name].filter(Boolean).join(" ") || "Guest",
          property: p.name,
          rating: x.public?.rating ?? x.rating ?? null,
          text: x.public?.review ?? x.review ?? x.public_review ?? "",
          date: String(x.reviewed_at ?? x.created_at ?? "").slice(0, 10),
        }));
      }),
    );
    return { ok: true, items: all.flat().sort((a, b) => b.date.localeCompare(a.date)) };
  } catch (e) {
    return { ok: false, error: (e as Error).message, items: [] };
  }
}
