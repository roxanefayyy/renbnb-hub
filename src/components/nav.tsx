"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Today", icon: "☀" },
  { href: "/leads", label: "Leads", icon: "✦" },
  { href: "/calendar", label: "Calendar", icon: "▦" },
  { href: "/money", label: "Money", icon: "₱" },
  { href: "/metrics", label: "Metrics", icon: "↗" },
  { href: "/content", label: "Content", icon: "✎" },
  { href: "/guests", label: "Guests", icon: "♥" },
  { href: "/tasks", label: "Tasks", icon: "✓" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Nav() {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col bg-timber px-5 py-7">
        <div className="mb-8">
          <div className="font-display text-xl font-semibold text-linen">RenBNB</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-rustic font-semibold">Operations Hub</div>
        </div>
        <nav className="flex flex-col gap-1">
          {ITEMS.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                active(i.href) ? "bg-rustic/25 text-oat" : "text-white/55 hover:bg-rustic/15 hover:text-oat"
              }`}
            >
              <span className="w-4 text-center opacity-80">{i.icon}</span>
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto text-[11px] text-white/30">Thoughtful stays.</div>
      </aside>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-timber border-t border-white/10 flex overflow-x-auto">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex-1 min-w-[64px] flex flex-col items-center py-2 text-[10px] ${
              active(i.href) ? "text-maple" : "text-white/60"
            }`}
          >
            <span className="text-base leading-none mb-0.5">{i.icon}</span>
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
