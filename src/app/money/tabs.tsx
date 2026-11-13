import { Tabs } from "@/components/ui";

export function MoneyTabs({ current }: { current: string }) {
  return (
    <Tabs
      current={current}
      items={[
        { href: "/money", label: "Cashflow" },
        { href: "/money/pnl", label: "P&L" },
        { href: "/money/expenses", label: "Expenses" },
        { href: "/money/bills", label: "Bills & disbursements" },
        { href: "/money/payments", label: "Guest payments" },
      ]}
    />
  );
}
