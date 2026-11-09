import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const modelSource = await readFile(new URL("../src/lib/collectionDepositReport.js", import.meta.url), "utf8");
const modelUrl = dataUrl(modelSource);
const { getCollectionDepositData, createCollectionDepositPages } = await import(modelUrl);
const fixture = {
  rows: [
    { remittanceReferenceNo: "REM-001", todaysCashReceived: 100.1, amountToRemit: 100, status: "Checked" },
    { remittanceReferenceNo: "REM-002", todaysCashReceived: 200.2, amountToRemit: 200.2, status: "Unchecked" },
    { remittanceReferenceNo: "REM-003", todaysCashReceived: 0.1, confirmedCash: 0.1, status: "remitted" },
  ],
  collectionSources: [{ cashReceived: 99999 }],
};

test("daily collections are counted once; only checked remittances are deposits", () => {
  const data = getCollectionDepositData(fixture);
  assert.equal(data.collections, 300.4);
  assert.equal(data.deposited, 100.1);
  assert.equal(data.balance, 200.3);
  assert.equal(getCollectionDepositData().collections, 0);
  assert.equal(getCollectionDepositData({ rows: [{ todaysCashReceived: 0.1 }, { todaysCashReceived: 0.2 }] }).collections, 0.3);
});

test("only the requested portrait form is included and officer names stay blank", () => {
  const pages = createCollectionDepositPages(fixture, "2026-09-14");
  assert.equal(pages.length, 1);
  assert.equal(pages[0].landscape, false);
  const content = JSON.stringify(pages);
  for (const section of ["A. COLLECTIONS", "B. REMITTANCES / DEPOSITS", "For Collectors", "For Liquidating Officer"]) assert.ok(content.includes(section));
  for (const excluded of ["C. ACCOUNTABILITY", "D. SUMMARY", "CERTIFICATION", "SHIRLEY", "DANILO"]) assert.ok(!content.includes(excluded));
  assert.equal(pages[0].cells.find((c) => c.r === 28 && c.c === 1).value, "Name of Accountable Officer");
  assert.equal(pages[0].cells.find((c) => c.r === 24 && c.c === 5).value, 300.4);
  assert.equal(pages[0].cells.find((c) => c.r === 39 && c.c === 5).value, 100.1);
});

test("PDF and Excel exports use one portrait page with the requested form and numeric totals", async () => {
  const header = await readFile(new URL("../public/images/header.png", import.meta.url));
  let source = await readFile(new URL("../src/lib/exportCollectionDepositReport.js", import.meta.url), "utf8");
  source = source.replace('"exceljs"', JSON.stringify(pathToFileURL(require.resolve("exceljs")).href))
    .replace('"pdf-lib"', JSON.stringify(pathToFileURL(require.resolve("pdf-lib")).href))
    .replace('"./collectionDepositReport"', JSON.stringify(modelUrl))
    .replace('"./pdfHeader"', JSON.stringify(dataUrl(`export const getHeaderPngBytes = async () => new Uint8Array(Buffer.from(${JSON.stringify(header.toString("base64"))}, "base64"));`)));
  const { buildCollectionDepositPdf, buildCollectionDepositExcel } = await import(dataUrl(source));
  const { default: ExcelJS } = await import("exceljs");
  const { PDFDocument } = await import("pdf-lib");
  const options = { reportData: fixture, date: "2026-09-14" };
  const pdf = await buildCollectionDepositPdf(options);
  const bookBlob = await buildCollectionDepositExcel(options);
  const bookBuffer = Buffer.from(await bookBlob.arrayBuffer());
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bookBuffer);
  assert.equal(book.worksheets.length, 1);
  assert.equal(book.worksheets[0].pageSetup.orientation, "portrait");
  assert.equal(book.worksheets[0].pageSetup.fitToHeight, 1);
  assert.equal(book.worksheets[0].pageSetup.printArea, "A1:E40");
  assert.equal(book.worksheets[0].getCell("C32").master.address, "A28");
  assert.equal(book.worksheets[0].getCell("D32").master.address, "D28");
  assert.equal(book.worksheets[0].getCell("E32").master.address, "E28");
  assert.equal(book.worksheets[0].getImages().length, 1);
  assert.equal(book.worksheets[0].getCell("A14").fill.fgColor.argb, "FFECECEC");
  assert.equal(book.worksheets[0].getCell("E39").fill.fgColor.argb, "FFECECEC");
  const values = [];
  book.worksheets.forEach((sheet) => sheet.eachRow((row) => row.eachCell((cell) => values.push(cell.value))));
  assert.ok(values.includes(300.4));
  assert.ok(values.includes(100.1));
  assert.ok(!values.some((value) => /SHIRLEY|DANILO/.test(String(value))));
  const document = await PDFDocument.load(pdf);
  assert.equal(document.getPageCount(), 1);
  assert.ok(document.getPage(0).getWidth() < document.getPage(0).getHeight());
  const output = await mkdtemp(join(tmpdir(), "collection-deposit-check-"));
  await writeFile(join(output, "report.pdf"), pdf);
  await writeFile(join(output, "report.xlsx"), bookBuffer);
  console.log(`Export verification files: ${output}`);
  const manyRows = Array.from({ length: 70 }, (_, i) => ({ ...fixture.rows[0], remittanceReferenceNo: `REM-${i}-` + "1234567890".repeat(8) }));
  const longPdf = await buildCollectionDepositPdf({ ...options, reportData: { rows: manyRows } });
  assert.equal((await PDFDocument.load(longPdf)).getPageCount(), 1);
  const empty = await buildCollectionDepositPdf({ ...options, reportData: {} });
  assert.equal((await PDFDocument.load(empty)).getPageCount(), 1);
});
