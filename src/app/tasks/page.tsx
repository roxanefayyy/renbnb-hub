import { addTask, deleteTask, toggleTask } from "@/app/actions";
import { q } from "@/lib/db";
import { daysBetween, fmtDate, today } from "@/lib/util";
import { AddForm, Badge, Card, Empty, Field, PageHeader, Select } from "@/components/ui";

export const dynamic = "force-dynamic";

type Task = { id: number; title: string; area: string; priority: string; due: string | null; owner: string; done: boolean; created_on: string; done_on: string | null };
const AREAS = ["Ops", "Guests", "Money", "Marketing", "Channels", "Website", "Admin"];
const OWNERS = ["Roxanne", "Rhea", "Winnand", "Raymond", "Justine", "Paolo", "Vendor"];

export default async function TasksPage() {
  const t = today();
  const tasks = await q<Task>(
    `SELECT * FROM tasks WHERE NOT done OR done_on >= $1 ORDER BY done, CASE priority WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, due NULLS LAST, id`,
    [t.slice(0, 8) + "01"],
  );
  const open = tasks.filter((x) => !x.done);
  const stale = open.filter((x) => daysBetween(x.created_on, t) >= 5 && x.owner === "Roxanne");
  const mine = open.filter((x) => x.owner === "Roxanne");

  return (
    <div>
      <PageHeader eyebrow="RenBNB only" title="Tasks" />

      {stale.length > 0 && (
        <div className="rounded-lg px-4 py-2.5 text-sm font-medium border bg-maple/15 border-maple/30 text-rustic mb-5">
          ⚠ {stale.length} of your tasks are 5+ days old: {stale.slice(0, 3).map((s) => s.title).join(", ")}. Do it, delegate it, or delete it.
        </div>
      )}
      {mine.length > 0 && open.length > 0 && mine.length / open.length > 0.7 && open.length >= 5 && (
        <div className="rounded-lg px-4 py-2.5 text-sm border bg-sage border-timber/10 mb-5">
          {Math.round((mine.length / open.length) * 100)}% of open tasks are on you. Which of these can Rhea or Winnand take?
        </div>
      )}

      <AddForm label="Add task" action={addTask}>
        <Field label="Task" className="col-span-2"><input name="title" required className="input w-full" /></Field>
        <Field label="Priority"><Select name="priority" options={["Critical", "High", "Medium", "Low"]} defaultValue="Medium" required /></Field>
        <Field label="Due"><input type="date" name="due" className="input w-full" /></Field>
        <Field label="Area"><Select name="area" options={AREAS} defaultValue="Ops" required /></Field>
        <Field label="Owner"><Select name="owner" options={OWNERS} defaultValue="Roxanne" required /></Field>
      </AddForm>

      <Card>
        {tasks.length === 0 ? <Empty>No tasks.</Empty> : (
          <ul className="divide-y divide-timber/5">
            {tasks.map((x) => (
              <li key={x.id} className={`flex items-center gap-3 py-2 text-sm ${x.done ? "opacity-45" : ""}`}>
                <form action={toggleTask}><input type="hidden" name="id" value={x.id} /><button className={`w-5 h-5 rounded border ${x.done ? "bg-good border-good text-white" : "border-timber/30"} flex items-center justify-center text-xs`}>{x.done ? "✓" : ""}</button></form>
                <div className="flex-1">
                  <div className={x.done ? "line-through" : ""}>{x.title}</div>
                  <div className="text-xs muted">{x.area} · {x.owner}{!x.done && daysBetween(x.created_on, t) >= 5 ? ` · open ${daysBetween(x.created_on, t)} days` : ""}</div>
                </div>
                {x.due && <span className={`text-xs ${!x.done && x.due < t ? "text-bad font-medium" : "muted"}`}>{fmtDate(x.due)}</span>}
                <Badge>{x.priority}</Badge>
                <form action={deleteTask}><input type="hidden" name="id" value={x.id} /><button className="text-xs text-timber/40 hover:text-bad">✕</button></form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
