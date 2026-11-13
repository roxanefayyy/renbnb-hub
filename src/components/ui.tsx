import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="h1">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title && <h2 className="h2">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "good" | "warn" | "bad";
}) {
  const color = tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-timber";
  return (
    <div className="card">
      <div className="text-[11px] font-medium text-timber/55 mb-1">{label}</div>
      <div className={`font-display text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-timber/55 mt-1">{sub}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  new: "bg-maple/20 text-rustic",
  quoted: "bg-sage text-timber",
  booked: "bg-good/15 text-good",
  lost: "bg-timber/10 text-timber/60",
  Critical: "bg-bad/15 text-bad",
  High: "bg-warn/15 text-warn",
  Medium: "bg-maple/15 text-rustic",
  Low: "bg-timber/10 text-timber/60",
  idea: "bg-timber/10 text-timber/60",
  drafted: "bg-maple/20 text-rustic",
  scheduled: "bg-sage text-timber",
  posted: "bg-good/15 text-good",
  received: "bg-good/15 text-good",
  pending: "bg-maple/20 text-rustic",
  overdue: "bg-bad/15 text-bad",
  paid: "bg-good/15 text-good",
  due: "bg-maple/20 text-rustic",
  accepted: "bg-good/15 text-good",
  cancelled: "bg-timber/10 text-timber/60",
};

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${TONES[tone ?? String(children)] ?? "bg-timber/10 text-timber/70"}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-sm text-timber/50 py-4 text-center">{children}</div>;
}

export function Tabs({ items, current }: { items: { href: string; label: string }[]; current: string }) {
  return (
    <div className="flex flex-wrap gap-1 mb-5 border-b border-timber/10">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 ${
            current === i.href ? "border-rustic text-timber" : "border-transparent text-timber/50 hover:text-timber"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Select({ name, options, defaultValue, required, className = "" }: {
  name: string;
  options: (string | { value: string | number; label: string })[];
  defaultValue?: string | number | null;
  required?: boolean;
  className?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} required={required} className={`input w-full ${className}`}>
      {!required && <option value="">—</option>}
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

/** Collapsible add form */
export function AddForm({ label, action, children }: { label: string; action: (fd: FormData) => Promise<void>; children: ReactNode }) {
  return (
    <details className="card mb-5 group">
      <summary className="cursor-pointer list-none flex items-center justify-between">
        <span className="font-medium text-sm">+ {label}</span>
        <span className="text-xs muted group-open:hidden">open</span>
      </summary>
      <form action={action} className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {children}
        <div className="col-span-2 md:col-span-4">
          <button className="btn">Save</button>
        </div>
      </form>
    </details>
  );
}

export function Bar({ value, max, tone = "bg-rustic" }: { value: number; max: number; tone?: string }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded-full bg-timber/10 overflow-hidden">
      <div className={`h-full ${tone}`} style={{ width: `${w}%` }} />
    </div>
  );
}
