import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../src/lib/dashboardRevenue.js", import.meta.url), "utf8");
const { getTransactionRevenueByPeriod } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("quarterly earned revenue reconciles to the annual total instead of cash received", () => {
  const data = {
    dockings: [{ docking_date: "2026-03-31", docking_fee: 150000 }],
    banyeraTransactions: [{ transaction_date: "2026-04-01", total_fee: 200000 }],
    vehicleTickets: [{ ticket_date: "2026-09-30", ticket_fee: 120000 }],
    penalties: [{ fiscal_date: "2026-10-01", date: "2027-01-01", amount: 5778 }],
    payments: [{ payment_date: "2026-11-09", amount_paid: 319000 }],
    remittances: [{ date: "2026-11-09", amount: 250000 }],
  };
  const result = getTransactionRevenueByPeriod(data, 2026);
  assert.equal(result.total, 475778);
  assert.deepEqual(result.quarters, [150000, 200000, 120000, 5778]);
  assert.equal(result.quarters.reduce((sum, value) => sum + value, 0), result.total);
  assert.equal(result.monthly.reduce((sum, value) => sum + value, 0), result.total);
  data.payments.push({ amount_paid: 100000 });
  assert.equal(getTransactionRevenueByPeriod(data, 2026).total, 475778);
});

test("quarter boundaries use transaction dates and penalties stay with their bill fiscal date", () => {
  const result = getTransactionRevenueByPeriod({
    dockings: [{ docking_date: "2025-12-31", docking_fee: 1000 }, { docking_date: "2026-01-01T00:00:00+08:00", docking_fee: 10.1 }],
    banyeraTransactions: [{ transaction_date: "2026-06-30", total_fee: 0, items: [{ subtotal: 0.1 }, { subtotal: 0.2 }] }],
    vehicleTickets: [{ ticket_date: "2026-07-01", ticket_fee: 20 }, { issued_at: "2026-12-31", ticket_fee: 30 }],
    penalties: [{ fiscal_date: "2025-12-01", date: "2026-01-01", amount: 50 }],
  }, 2026);
  assert.deepEqual(result.quarters, [10.1, 0.3, 20, 30]);
  assert.equal(result.total, 60.4);
});

test("voided transactions, invalid dates and other years do not inflate revenue", () => {
  const result = getTransactionRevenueByPeriod({
    dockings: [{ docking_date: "2026-01-01", docking_fee: 500, voided_at: "2026-01-02" }],
    banyeraTransactions: [{ transaction_date: "2026-01-01", total_fee: 500, status: "voided" }],
    vehicleTickets: [{ ticket_date: "2026-01-01", ticket_fee: 500, is_voided: true }, { ticket_date: "invalid", ticket_fee: 500 }, { ticket_date: "2027-01-01", ticket_fee: 500 }],
  }, 2026);
  assert.equal(result.total, 0);
  assert.deepEqual(result.quarters, [0, 0, 0, 0]);
  assert.equal(getTransactionRevenueByPeriod({}, 2026).total, 0);
});
