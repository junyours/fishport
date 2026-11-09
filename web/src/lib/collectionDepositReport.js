const cents = (value) => Math.round(Number(value || 0) * 100);
const money = (value) => value / 100;

// Use the same daily rows as the Remittance report. Collection sources are
// separate transactions and must not be added again to remittance collections.
export function getCollectionDepositData(reportData = {}) {
  const rows = Array.isArray(reportData.rows) ? reportData.rows : [];
  const remittances = rows.map((row) => ({
    reference: String(row.remittanceReferenceNo || ""),
    collection: money(cents(row.todaysCashReceived)),
    amount: money(cents(row.amountToRemit ?? row.confirmedCash)),
    checked: ["checked", "remitted"].includes(String(row.status || "").trim().toLowerCase()),
  }));
  const collections = remittances.reduce((sum, row) => sum + cents(row.collection), 0);
  const deposited = remittances.filter((row) => row.checked).reduce((sum, row) => sum + cents(row.amount), 0);
  return {
    remittances,
    collections: money(collections),
    deposited: money(deposited),
    balance: money(collections - deposited),
  };
}

// Fixed single-page form matching the supplied portrait reference.
export function createCollectionDepositPages(reportData, date) {
  const data = getCollectionDepositData(reportData);
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
  const cells = [];
  const add = (r, c, value = "", options = {}) => cells.push({ r, c, value, ...options });
  add(2, 1, "REPORT ON COLLECTIONS AND DEPOSITS", { cs: 5, bold: true, align: "center", size: 12 });
  add(3, 1, "Opol Misamis Oriental", { cs: 5, align: "center" });
  add(4, 1, "LGU", { cs: 5, align: "center" });
  add(7, 1, "Fund: WHARF/BERTHING", { cs: 3, bold: true, align: "center" });
  add(7, 4, `Date: ${dateLabel}`, { cs: 2, bold: true, align: "center" });
  add(8, 1, "Name of Accountable Officer: __________________", { cs: 3, bold: true, align: "center" });
  add(8, 4, "Report No.: __________________", { cs: 2, bold: true, align: "center" });
  add(10, 1, "A. COLLECTIONS", { cs: 5, bold: true });
  add(12, 1, "1. For Collectors", { cs: 5, indent: 28 });
  add(14, 1, "TYPE OF FORM\n(Form No.)", { rs: 2, bold: true, align: "center" });
  add(14, 2, "QUANTITY", { rs: 2, bold: true, align: "center" });
  add(14, 3, "OFFICIAL RECEIPT / SERIAL NO.", { cs: 2, bold: true, align: "center" });
  add(15, 3, "From", { align: "center" });
  add(15, 4, "To", { align: "center" });
  add(14, 5, "AMOUNT", { rs: 2, bold: true, align: "center" });
  // Daily remittances do not contain accountable-form inventory. Print the
  // collection amount without inventing form quantities or serial ranges.
  add(20, 5, data.collections, { money: true });
  add(24, 4, "TOTAL", { bold: true, align: "center" });
  add(24, 5, data.collections, { money: true, bold: true, total: true });
  add(27, 1, "2. For Liquidating Officer / Treasurers", { cs: 3, align: "center" });
  add(27, 4, "REPORT NO.", { bold: true, align: "center" });
  add(27, 5, "AMOUNT", { bold: true, align: "center" });
  add(28, 1, "Name of Accountable Officer", { cs: 3, rs: 5, bold: true, align: "center", signature: true, vertical: "middle" });
  add(28, 4, "", { rs: 5 });
  add(28, 5, data.collections, { rs: 5, money: true, bold: true });
  add(33, 1, "B. REMITTANCES / DEPOSITS", { cs: 5, bold: true });
  add(34, 1, "Accountable Officer / Bank", { cs: 3, bold: true, align: "center" });
  add(34, 4, "REFERENCE", { bold: true, align: "center" });
  add(34, 5, "AMOUNT", { bold: true, align: "center" });
  add(35, 1, "", { cs: 3 });
  add(36, 1, "BASIC", { bold: true });
  add(36, 5, data.deposited, { money: true, bold: true });
  add(37, 1, "S.E.F", { bold: true });
  add(38, 1, "", { cs: 3 });
  add(39, 1, "TOTAL:", { cs: 3, bold: true });
  add(39, 5, data.deposited, { money: true, bold: true, total: true });
  add(40, 1, "", { cs: 3 });
  return [{
    name: "Collections and Deposits", landscape: false,
    widths: [18, 12, 24, 22, 24],
    // The first four rows exactly fill the 82-point header. The old spacer
    // row has zero height so the body's outer borders meet the header.
    rowHeights: Array.from({ length: 40 }, (_, i) => i === 4 ? 0 : i === 1 || i === 3 ? 24 : 17),
    cells,
    // Only the actual ruled areas of the reference have internal borders.
    grids: [[14, 1, 25, 5], [27, 1, 32, 5], [34, 1, 40, 5]],
  }];
}
