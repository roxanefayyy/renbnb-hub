"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { q, one } from "@/lib/db";
import { importCsv, syncHospitable } from "@/lib/bookings";
import { num, str, today } from "@/lib/util";
import { COOKIE } from "@/lib/session";

const refresh = (...paths: string[]) => {
  for (const p of ["/", ...paths]) revalidatePath(p);
};
const n = (v: FormDataEntryValue | null) => (str(v) === null ? null : num(v));

/* Leads */
export async function addLead(fd: FormData) {
  await q(
    `INSERT INTO leads (created_on, source, name, contact, checkin, checkout, guests, property_interest, quote, status, follow_up, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [str(fd.get("created_on")) ?? today(), str(fd.get("source")) ?? "WhatsApp", str(fd.get("name")) ?? "Unknown", str(fd.get("contact")),
      str(fd.get("checkin")), str(fd.get("checkout")), n(fd.get("guests")), str(fd.get("property_interest")), n(fd.get("quote")),
      str(fd.get("status")) ?? "new", str(fd.get("follow_up")) ?? today(), str(fd.get("notes"))],
  );
  refresh("/leads");
}

export async function updateLead(fd: FormData) {
  const id = num(fd.get("id"));
  const status = str(fd.get("status")) ?? "new";
  await q(
    `UPDATE leads SET status=$2, quote=$3, follow_up=$4, lost_reason=$5, notes=$6, checkin=$7, checkout=$8, guests=$9, property_interest=$10, updated_at=now() WHERE id=$1`,
    [id, status, n(fd.get("quote")), status === "booked" || status === "lost" ? null : str(fd.get("follow_up")),
      status === "lost" ? str(fd.get("lost_reason")) : null, str(fd.get("notes")), str(fd.get("checkin")), str(fd.get("checkout")),
      n(fd.get("guests")), str(fd.get("property_interest"))],
  );
  refresh("/leads");
}

export async function deleteLead(fd: FormData) {
  await q(`DELETE FROM leads WHERE id=$1`, [num(fd.get("id"))]);
  refresh("/leads");
}

/* Guest payments (GCash / bank) */
export async function addGuestPayment(fd: FormData) {
  await q(
    `INSERT INTO guest_payments (guest_name, reservation_code, lead_id, kind, method, amount, due_date, received_date, reference_no, account_id, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [str(fd.get("guest_name")) ?? "Guest", str(fd.get("reservation_code")), n(fd.get("lead_id")), str(fd.get("kind")) ?? "balance",
      str(fd.get("method")) ?? "bank", num(fd.get("amount")), str(fd.get("due_date")), str(fd.get("received_date")),
      str(fd.get("reference_no")), n(fd.get("account_id")), str(fd.get("notes"))],
  );
  refresh("/money/payments", "/money");
}

export async function markPaymentReceived(fd: FormData) {
  await q(`UPDATE guest_payments SET received_date=$2, reference_no=COALESCE($3,reference_no), account_id=COALESCE($4,account_id) WHERE id=$1`, [
    num(fd.get("id")), str(fd.get("received_date")) ?? today(), str(fd.get("reference_no")), n(fd.get("account_id")),
  ]);
  refresh("/money/payments", "/money");
}

export async function deleteGuestPayment(fd: FormData) {
  await q(`DELETE FROM guest_payments WHERE id=$1`, [num(fd.get("id"))]);
  refresh("/money/payments", "/money");
}

/* Expenses */
export async function addExpense(fd: FormData) {
  await q(
    `INSERT INTO expenses (date, property_id, category, description, amount, account_id, vendor, receipt_no, receipt_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [str(fd.get("date")) ?? today(), n(fd.get("property_id")), str(fd.get("category")) ?? "Miscellaneous", str(fd.get("description")),
      num(fd.get("amount")), n(fd.get("account_id")), str(fd.get("vendor")), str(fd.get("receipt_no")), str(fd.get("receipt_url"))],
  );
  refresh("/money/expenses", "/money");
}

export async function deleteExpense(fd: FormData) {
  const id = num(fd.get("id"));
  await q(`DELETE FROM bill_payments WHERE expense_id=$1`, [id]);
  await q(`DELETE FROM expenses WHERE id=$1`, [id]);
  refresh("/money/expenses", "/money/bills", "/money");
}

/* Bills (recurring disbursements) */
export async function addBill(fd: FormData) {
  await q(
    `INSERT INTO bills (name, category, amount, frequency, day, property_id, account_id, start_date, end_date, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [str(fd.get("name")) ?? "Bill", str(fd.get("category")) ?? "Miscellaneous", num(fd.get("amount")), str(fd.get("frequency")) ?? "monthly",
      num(fd.get("day")) || 1, n(fd.get("property_id")), n(fd.get("account_id")), str(fd.get("start_date")) ?? today(),
      str(fd.get("end_date")), str(fd.get("notes"))],
  );
  refresh("/money/bills", "/money");
}

export async function toggleBill(fd: FormData) {
  await q(`UPDATE bills SET active = NOT active WHERE id=$1`, [num(fd.get("id"))]);
  refresh("/money/bills", "/money");
}

export async function deleteBill(fd: FormData) {
  await q(`DELETE FROM bills WHERE id=$1`, [num(fd.get("id"))]);
  refresh("/money/bills", "/money");
}

/** Mark a bill occurrence paid: logs the expense automatically (no double typing). */
export async function payBill(fd: FormData) {
  const billId = num(fd.get("bill_id"));
  const due = str(fd.get("due_date"))!;
  const bill = await one<{ name: string; category: string; amount: number; property_id: number | null; account_id: number | null }>(
    `SELECT name, category, amount::float8 AS amount, property_id, account_id FROM bills WHERE id=$1`,
    [billId],
  );
  if (!bill) return;
  const amount = n(fd.get("amount")) ?? bill.amount;
  const paidDate = str(fd.get("paid_date")) ?? today();
  const exp = await one<{ id: number }>(
    `INSERT INTO expenses (date, property_id, category, description, amount, account_id, bill_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [paidDate, bill.property_id, bill.category, `${bill.name} (due ${due})`, amount, bill.account_id, billId],
  );
  await q(
    `INSERT INTO bill_payments (bill_id, due_date, paid_date, amount, expense_id) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (bill_id, due_date) DO NOTHING`,
    [billId, due, paidDate, amount, exp?.id ?? null],
  );
  refresh("/money/bills", "/money/expenses", "/money");
}

/* Cash accounts */
export async function saveBalances(fd: FormData) {
  const date = str(fd.get("date")) ?? today();
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("bal_") || str(v) === null) continue;
    await q(
      `INSERT INTO balance_checks (account_id, date, balance) VALUES ($1,$2,$3)
       ON CONFLICT (account_id, date) DO UPDATE SET balance=EXCLUDED.balance`,
      [num(k.slice(4)), date, num(v)],
    );
  }
  refresh("/money");
}

export async function addAccount(fd: FormData) {
  await q(`INSERT INTO accounts (name, kind, opening_balance, opening_date) VALUES ($1,$2,$3,$4) ON CONFLICT (name) DO NOTHING`, [
    str(fd.get("name")) ?? "Account", str(fd.get("kind")) ?? "bank", num(fd.get("opening_balance")), str(fd.get("opening_date")) ?? "2026-01-01",
  ]);
  refresh("/settings", "/money");
}

export async function renameAccount(fd: FormData) {
  await q(`UPDATE accounts SET name=$2, opening_balance=$3 WHERE id=$1`, [num(fd.get("id")), str(fd.get("name")), num(fd.get("opening_balance"))]);
  refresh("/settings", "/money");
}

/* Reservations: mark payout received */
export async function markPayout(fd: FormData) {
  await q(`UPDATE reservations SET actual_cash_date=$2 WHERE code=$1`, [str(fd.get("code")), str(fd.get("date")) ?? today()]);
  refresh("/money");
}

/* Tasks */
export async function addTask(fd: FormData) {
  await q(`INSERT INTO tasks (title, area, priority, due, owner, created_on) VALUES ($1,$2,$3,$4,$5,$6)`, [
    str(fd.get("title")) ?? "Task", str(fd.get("area")) ?? "Ops", str(fd.get("priority")) ?? "Medium", str(fd.get("due")),
    str(fd.get("owner")) ?? "Roxanne", today(),
  ]);
  refresh("/tasks");
}

export async function toggleTask(fd: FormData) {
  await q(`UPDATE tasks SET done = NOT done, done_on = CASE WHEN done THEN NULL ELSE $2 END WHERE id=$1`, [num(fd.get("id")), today()]);
  refresh("/tasks");
}

export async function deleteTask(fd: FormData) {
  await q(`DELETE FROM tasks WHERE id=$1`, [num(fd.get("id"))]);
  refresh("/tasks");
}

/* Content */
export async function addPost(fd: FormData) {
  await q(`INSERT INTO content_posts (date, platform, pillar, title, caption, status, link) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
    str(fd.get("date")) ?? today(), str(fd.get("platform")) ?? "Instagram", str(fd.get("pillar")) ?? "The Space", str(fd.get("title")) ?? "Post",
    str(fd.get("caption")), str(fd.get("status")) ?? "idea", str(fd.get("link")),
  ]);
  refresh("/content");
}

export async function updatePost(fd: FormData) {
  await q(`UPDATE content_posts SET status=$2, inquiries=$3, link=$4, date=$5 WHERE id=$1`, [
    num(fd.get("id")), str(fd.get("status")) ?? "idea", num(fd.get("inquiries")), str(fd.get("link")), str(fd.get("date")) ?? today(),
  ]);
  refresh("/content");
}

export async function deletePost(fd: FormData) {
  await q(`DELETE FROM content_posts WHERE id=$1`, [num(fd.get("id"))]);
  refresh("/content");
}

/* Bookings data */
export async function uploadCsv(fd: FormData) {
  const file = fd.get("file") as File | null;
  if (!file || file.size === 0) redirect("/settings?msg=" + encodeURIComponent("Choose a CSV file first."));
  let msg: string;
  try {
    const r = await importCsv(await file!.text());
    msg = `Imported: ${r.inserted} added, ${r.updated} updated, ${r.ignored} pre-2026 rows skipped.` +
      (r.unmapped.length ? ` Unmapped listings: ${r.unmapped.join(", ")}` : "");
  } catch (e) {
    msg = "Import failed: " + (e as Error).message;
  }
  refresh("/settings", "/metrics", "/calendar", "/money");
  redirect("/settings?msg=" + encodeURIComponent(msg));
}

export async function runSync() {
  let msg: string;
  console.log("[sync] manual Hospitable sync started");
  try {
    const r = await syncHospitable();
    console.log("[sync] done", JSON.stringify(r));
    msg = `Hospitable sync: ${r.fetched} fetched, ${r.inserted} added, ${r.updated} updated.` +
      (r.unmapped.length ? ` Unmatched listings: ${r.unmapped.join(", ")}` : "");
  } catch (e) {
    console.error("[sync] failed", e);
    msg = "Sync failed: " + (e as Error).message;
  }
  refresh("/settings", "/metrics", "/calendar", "/money");
  redirect("/settings?msg=" + encodeURIComponent(msg));
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}
