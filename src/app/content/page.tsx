import { addPost, deletePost, updatePost } from "@/app/actions";
import { q } from "@/lib/db";
import { addDays, CONTENT_PLATFORMS, CONTENT_STATUSES, fmtDate, fmtDay, PILLARS, today } from "@/lib/util";
import { AddForm, Badge, Bar, Card, Empty, Field, PageHeader, Select, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const FOOTER = `📍 30 mins from Mactan-Cebu airport. 15 mins from IT Park, Ayala Center and SM City.
🏠 From ₱3,500/night for 4 guests. Add ₱400 per extra guest, up to 12.
💬 Staying a week or booking two units? Message us for a better rate.
Book direct: https://renbnb-hello.vercel.app/`;

type Post = { id: number; date: string; platform: string; pillar: string; title: string; caption: string | null; status: string; link: string | null; inquiries: number };

export default async function ContentPage() {
  const t = today();
  const [posts, recent] = await Promise.all([
    q<Post>(`SELECT * FROM content_posts WHERE date >= $1 ORDER BY date, id`, [addDays(t, -14)]),
    q<{ pillar: string; n: number; inquiries: number }>(
      `SELECT pillar, count(*)::int AS n, COALESCE(sum(inquiries),0)::int AS inquiries FROM content_posts WHERE status='posted' AND date >= $1 GROUP BY pillar`,
      [addDays(t, -30)],
    ),
  ]);
  const next7 = posts.filter((p) => p.date >= t && p.date <= addDays(t, 6));
  const postedThisWeek = posts.filter((p) => p.status === "posted" && p.date >= addDays(t, -6) && p.date <= t).length;
  const totalPosted = recent.reduce((s, r) => s + r.n, 0);
  const totalInq = recent.reduce((s, r) => s + r.inquiries, 0);
  const missing = PILLARS.filter((p) => !recent.find((r) => r.pillar === p));

  return (
    <div>
      <PageHeader eyebrow="Social" title="Content">
        <a href="https://business.facebook.com/latest/content_calendar" target="_blank" rel="noreferrer" className="btn-ghost">Meta Planner ↗</a>
        <a href="https://www.tiktok.com/tiktokstudio/upload" target="_blank" rel="noreferrer" className="btn-ghost">TikTok Studio ↗</a>
        <a href="https://www.canva.com" target="_blank" rel="noreferrer" className="btn-ghost">Canva ↗</a>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Posted last 7 days" value={postedThisWeek} sub="Aim for 4+" tone={postedThisWeek >= 4 ? "good" : "warn"} />
        <Stat label="Planned next 7 days" value={next7.length} tone={next7.length >= 4 ? "good" : "warn"} />
        <Stat label="Inquiries from posts (30d)" value={totalInq} sub={`${totalPosted} posts`} />
        <Stat label="Pillars skipped (30d)" value={missing.length} sub={missing.slice(0, 2).join(", ") || "Good rotation"} />
      </div>

      <AddForm label="Plan a post" action={addPost}>
        <Field label="Date"><input type="date" name="date" defaultValue={t} className="input w-full" required /></Field>
        <Field label="Platform"><Select name="platform" options={CONTENT_PLATFORMS} required /></Field>
        <Field label="Pillar"><Select name="pillar" options={PILLARS} required /></Field>
        <Field label="Status"><Select name="status" options={CONTENT_STATUSES} defaultValue="idea" required /></Field>
        <Field label="Working title / hook" className="col-span-2 md:col-span-4"><input name="title" required className="input w-full" /></Field>
        <Field label="Caption" className="col-span-2 md:col-span-4"><textarea name="caption" rows={4} className="input w-full" defaultValue={"\n\n" + FOOTER} /></Field>
        <Field label="Canva / draft link" className="col-span-2"><input name="link" className="input w-full" /></Field>
      </AddForm>

      <div className="grid md:grid-cols-3 gap-5">
        <Card title="Plan (last 2 weeks → ahead)" className="md:col-span-2">
          {posts.length === 0 ? <Empty>No posts planned. Plan the week every Monday.</Empty> : (
            <div className="divide-y divide-timber/5">
              {posts.map((p) => (
                <details key={p.id} className="py-2">
                  <summary className="cursor-pointer list-none grid grid-cols-12 gap-2 items-center text-sm">
                    <span className={`col-span-3 md:col-span-2 text-xs ${p.date === t ? "text-rustic font-semibold" : "muted"}`}>{fmtDay(p.date)} {fmtDate(p.date)}</span>
                    <span className="col-span-6 md:col-span-6 font-medium">{p.title}<span className="block text-xs muted font-normal">{p.platform} · {p.pillar}</span></span>
                    <span className="hidden md:block md:col-span-2 text-xs muted">{p.inquiries ? `${p.inquiries} inquiries` : ""}</span>
                    <span className="col-span-3 md:col-span-2 text-right"><Badge>{p.status}</Badge></span>
                  </summary>
                  {p.caption && <pre className="whitespace-pre-wrap text-xs bg-linen/60 rounded-lg p-3 mt-2 font-sans">{p.caption}</pre>}
                  <form action={updatePost} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <Field label="Date"><input type="date" name="date" defaultValue={p.date} className="input" /></Field>
                    <Field label="Status"><Select name="status" options={CONTENT_STATUSES} defaultValue={p.status} required /></Field>
                    <Field label="Inquiries it brought"><input type="number" name="inquiries" defaultValue={p.inquiries} min={0} className="input w-24" /></Field>
                    <Field label="Link"><input name="link" defaultValue={p.link ?? ""} className="input" /></Field>
                    <button className="btn">Update</button>
                    <button formAction={deletePost} className="btn-ghost text-bad">Delete</button>
                  </form>
                </details>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Pillar mix (30 days)">
            <ul className="space-y-2 text-sm">
              {PILLARS.map((p) => {
                const r = recent.find((x) => x.pillar === p);
                return (
                  <li key={p}>
                    <div className="flex justify-between mb-1"><span>{p}</span><span className="muted">{r?.n ?? 0}{r?.inquiries ? ` · ${r.inquiries} inq` : ""}</span></div>
                    <Bar value={r?.n ?? 0} max={Math.max(1, ...recent.map((x) => x.n))} />
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card title="Every caption ends with">
            <pre className="whitespace-pre-wrap text-xs font-sans bg-linen/60 rounded-lg p-3">{FOOTER}</pre>
          </Card>
        </div>
      </div>
    </div>
  );
}
