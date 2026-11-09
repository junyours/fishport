const cents = (value) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

// Earned transaction revenue, independent of when a bill is paid or remitted.
// Penalties retain the fiscal date supplied by their parent bill.
export function getTransactionRevenueByPeriod(data = {}, year) {
  const monthlyCents = Array(12).fill(0);
  const add = (record, date, amountCents) => {
    if (record?.is_voided || record?.voided_at || String(record?.status ?? "").toLowerCase() === "voided") return;
    const parts = String(date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!parts || Number(parts[1]) !== Number(year)) return;
    const month = Number(parts[2]) - 1;
    if (month < 0 || month > 11) return;
    monthlyCents[month] += amountCents;
  };
  for (const docking of data.dockings ?? []) {
    add(docking, docking.docking_date || docking.created_at, cents(docking.docking_fee));
  }
  for (const transaction of data.banyeraTransactions ?? []) {
    const amount = Number(transaction.total_fee ?? 0) > 0
      ? cents(transaction.total_fee)
      : (transaction.items ?? []).reduce((sum, item) => sum + cents(item.subtotal), 0);
    add(transaction, transaction.transaction_date || transaction.created_at, amount);
  }
  for (const ticket of data.vehicleTickets ?? []) {
    add(ticket, ticket.ticket_date || ticket.issued_at || ticket.created_at, cents(ticket.ticket_fee));
  }
  for (const penalty of data.penalties ?? []) {
    add(penalty, penalty.fiscal_date, cents(penalty.amount));
  }
  return {
    monthly: monthlyCents.map((amount) => amount / 100),
    quarters: Array.from({ length: 4 }, (_, quarter) => monthlyCents.slice(quarter * 3, quarter * 3 + 3).reduce((sum, amount) => sum + amount, 0) / 100),
    total: monthlyCents.reduce((sum, amount) => sum + amount, 0) / 100,
  };
}
