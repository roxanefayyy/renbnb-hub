"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-lg mx-auto mt-16 card space-y-3">
      <div className="eyebrow">Something broke</div>
      <h1 className="h2">This page couldn&apos;t load</h1>
      <p className="text-sm muted">
        The most common cause is the database not being connected. In Vercel, open <b>Storage</b> → your Neon database →{" "}
        <b>Connect Project</b> → renbnb-hub (Production), then redeploy.
      </p>
      {error.digest && <p className="text-xs muted">Error code: {error.digest} (the Vercel logs show the full error)</p>}
      <div className="flex gap-2">
        <button onClick={reset} className="btn">Try again</button>
        <a href="/settings" className="btn-ghost">Settings</a>
      </div>
    </div>
  );
}
