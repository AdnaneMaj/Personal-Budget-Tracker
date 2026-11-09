import {
  LayoutDashboard,
  CalendarDays,
  WalletCards,
  Coins,
  BarChart3,
} from "lucide-react";

export const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "months", label: "Months", icon: CalendarDays },
  { id: "budget", label: "Budget", icon: WalletCards },
  { id: "transactions", label: "Transactions", icon: Coins },
  { id: "receivables", label: "Receivable", icon: WalletCards },
  { id: "savings", label: "Savings", icon: BarChart3 },
];

export const monthShortNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const zakatStatusLabels = {
  missing_price: "Add price",
  not_started: "Not started",
  below_nisab: "Below nisab",
  tracking: "Tracking",
  due: "Due",
};

export const zakatEventLabels = {
  initial_anchor: "Initial anchor",
  missing_price: "Waiting for price",
  nisab_reached: "Nisab reached",
  anchor_reset: "Anchor reset",
  zakat_due: "Zakat due",
  zakat_paid: "Zakat paid",
};
