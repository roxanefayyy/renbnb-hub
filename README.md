# RenBNB Operations Hub

Roxanne's single cockpit for running RenBNB: today's guests, leads, calendar, money (cashflow, P&L, expenses, bills, GCash/bank payments), metrics, content, guests and tasks.

Built with Next.js on Vercel and Postgres (Neon). Bookings sync automatically from Hospitable every day at 5am Manila time.

---

## Deploy on Vercel (≈10 minutes, one time)

1. **Import the repo.** In Vercel, go to **Add New → Project**, pick `renbnb-hub` and click **Deploy**. The first deploy works, but login won't until step 3.
2. **Add the database.** In the project, open **Storage → Create Database → Neon (Postgres)**, pick the Singapore region if you're offered one, then **Connect** it to this project. That adds `DATABASE_URL` for you. The tables create themselves on first load.
3. **Add environment variables** under **Settings → Environment Variables**:

   | Name | Value |
   |---|---|
   | `HUB_PASSWORD` | your login password |
   | `SESSION_SECRET` | any long random string (mash the keyboard, 40+ characters) |
   | `HOSPITABLE_TOKEN` | personal access token from Hospitable (see below) |
   | `CRON_SECRET` | another long random string |

4. **Redeploy:** **Deployments → ⋯ → Redeploy**.
5. Open the site, log in, go to **Settings → Sync Hospitable now**.
6. On your phone, open the site and choose **Add to Home Screen**.

### Getting the Hospitable token
In Hospitable, open your account settings and look for the **API / Personal access tokens** section. Create a token with read access to properties, reservations and reviews, then paste it into Vercel. Never paste it into a chat or a file. If you don't see the section, your Hospitable plan may not include API access. Until that's sorted, use **Settings → Import CSV** with the *Reservations & Financials* export.

---

## How the money works

- **Revenue** comes from bookings and is never typed. It is counted in the **check-in month**.
  - Gross = net revenue + platform fee. The platform fee (host service fee) is shown as its own line for each channel.
  - Cancelled bookings that still paid out appear as **Cancellation income**.
- **Expenses** are typed in *Money → Expenses*, or logged automatically when you tick **Paid ✓** on a bill.
- **Bills & disbursements**: amortizations, condo dues, Rhea's weekly pay, utilities. You add each one once and it repeats.
- **Guest payments**: GCash and bank transfers for direct bookings, including deposits, balances, security deposits (held, not revenue), and refunds.
- **Cashflow forecast** starts from the balances you enter in *Daily cash check*. It adds expected platform payouts (Airbnb = check-in + 1 day; Booking.com and Agoda = checkout) and open guest payments, and subtracts bills due. New bookings you don't have yet are not counted, so the forecast is deliberately conservative.
- Occupancy = booked unit-nights ÷ (6 units × days). Twin Casa counts as Aurora + Olivia.

This is management accounting, not BIR books of account. Use it to brief your CPA.

## Local development
```bash
npm install
cp .env.example .env.local   # leave DATABASE_URL empty to use a local embedded database
npm run dev
```

## Roadmap
- v2: Exceptions list, monthly close checklist, bank/GCash CSV matching, debt schedule with balances, CPA export, tax-readiness memo.
- v3: Live unanswered-message counts (Hospitable + Meta), pricing alerts.
