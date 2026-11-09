import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createCollectionDepositPages } from "./collectionDepositReport";
import { getHeaderPngBytes } from "./pdfHeader";

const safe = (value) => String(value ?? "").replace(/[^\x20-\x7E\n]/g, " ");
const moneyFormat = '#,##0.00;[Red](#,##0.00);0.00';
const TITLE = "REPORT ON COLLECTIONS AND DEPOSITS";
const HEADER_ROWS = new Set([14, 15, 27, 34]);
const SHADED_ROWS = new Set([10, 14, 15, 24, 27, 33, 34, 39]);
const display = (cell) => cell.money
  ? Number(cell.value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : safe(cell.value);

export async function buildCollectionDepositPdf({ reportData, date }) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const header = await getHeaderPngBytes();
  const logo = header ? await doc.embedPng(header) : null;
  doc.setTitle(`REPORT ON COLLECTIONS AND DEPOSITS - ${date}`);
  for (const form of createCollectionDepositPages(reportData, date)) {
    const page = doc.addPage([595.28, 841.89]);
    const margin = 42;
    const width = 595.28 - margin * 2;
    const xs = [margin];
    form.widths.forEach((part) => xs.push(xs.at(-1) + width * part / 100));
    const ys = [841.89 - margin];
    form.rowHeights.forEach((height) => ys.push(ys.at(-1) - height));
    const line = (x1, y1, x2, y2, thickness = 1.5) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: rgb(0, 0, 0) });
    // The header and body share the same edge at the top of row six.
    const headerTop = ys[0];
    const headerBottom = headerTop - 82;
    const split = margin + width / 2;
    page.drawRectangle({ x: margin, y: headerBottom, width, height: 82, borderWidth: 1.5, color: rgb(1, 1, 1) });
    line(split, headerTop, split, headerBottom);
    line(split, headerTop - 53, margin + width, headerTop - 53);
    if (logo) {
      const dims = logo.scaleToFit(width / 2 - 15, 67);
      page.drawImage(logo, { x: margin + (width / 2 - dims.width) / 2, y: headerBottom + (82 - dims.height) / 2, ...dims });
    }
    const center = split + width / 4;
    [
      ["MUNICIPALITY OF OPOL", 12, 22, true],
      ["MUNICIPAL ECONOMIC ENTERPRISE OFFICE", 10, 33, false],
      ["OPOL FISH PORT", 10, 44, true],
      [TITLE, 9, 71, true],
    ].forEach(([label, size, offset, heavy]) => {
      const font = heavy ? bold : regular;
      const fitted = Math.min(size, size * (width / 2 - 12) / font.widthOfTextAtSize(label, size));
      page.drawText(label, { x: center - font.widthOfTextAtSize(label, fitted) / 2, y: headerTop - offset, size: fitted, font });
    });
    for (const r of SHADED_ROWS) {
      page.drawRectangle({ x: margin, y: ys[r], width, height: form.rowHeights[r - 1], color: rgb(236 / 255, 236 / 255, 236 / 255) });
    }
    // Draw each ruled cell, respecting the merged cells in the form.
    const merged = (r, c) => form.cells.find((cell) =>
      r >= cell.r && r < cell.r + (cell.rs || 1) && c >= cell.c && c < cell.c + (cell.cs || 1));
    for (const [r1, c1, r2, c2] of form.grids) {
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        const cell = merged(r, c);
        if (!cell || r === cell.r) line(xs[c - 1], ys[r - 1], xs[c], ys[r - 1]);
        if (!cell || c === cell.c) line(xs[c - 1], ys[r - 1], xs[c - 1], ys[r]);
      }
      line(xs[c1 - 1], ys[r2], xs[c2], ys[r2]);
      line(xs[c2], ys[r1 - 1], xs[c2], ys[r2]);
    }
    line(xs[0], ys[40], xs[5], ys[40]);
    line(xs[0], ys[5], xs[0], ys[40]);
    line(xs[5], ys[5], xs[5], ys[40]);
    for (const cell of form.cells) {
      if (cell.r <= 4) continue;
      const font = cell.bold || HEADER_ROWS.has(cell.r) ? bold : regular;
      const text = display(cell);
      const lines = text.split("\n");
      const left = xs[cell.c - 1];
      const right = xs[cell.c - 1 + (cell.cs || 1)];
      const top = ys[cell.r - 1];
      const bottom = ys[cell.r - 1 + (cell.rs || 1)];
      let size = HEADER_ROWS.has(cell.r) ? 8 : cell.size || 9;
      const available = right - left - 10 - (cell.indent || 0);
      const natural = Math.max(...lines.map((part) => font.widthOfTextAtSize(part, size)));
      if (natural > available) size *= available / natural;
      const lineHeight = size + 3;
      const y = (top + bottom) / 2 + (lines.length - 1) * lineHeight / 2 - size * 0.35;
      lines.forEach((part, index) => {
        const textWidth = font.widthOfTextAtSize(part, size);
        const x = cell.money ? right - 6 - textWidth : cell.align === "center" ? (left + right - textWidth) / 2 : left + 5 + (cell.indent || 0);
        if (part) page.drawText(part, { x, y: y - index * lineHeight, size, font });
      });
      if (cell.signature) line(left + 40, y + 16, right - 40, y + 16, 0.75);
    }
  }
  return doc.save();
}

export async function buildCollectionDepositExcel({ reportData, date }) {
  const workbook = new ExcelJS.Workbook();
  const header = await getHeaderPngBytes();
  const logoId = header ? workbook.addImage({ buffer: header, extension: "png" }) : null;
  workbook.creator = "Opol Fish Port";
  const edge = { style: "thin", color: { argb: "FF080616" } };
  for (const form of createCollectionDepositPages(reportData, date)) {
    const sheet = workbook.addWorksheet(form.name, {
      pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0, footer: 0 } },
      views: [{ showGridLines: false }],
    });
    form.widths.forEach((width, i) => { sheet.getColumn(i + 1).width = width; });
    form.rowHeights.forEach((height, i) => { sheet.getRow(i + 1).height = height; });
    sheet.getRow(5).hidden = true;
    for (const r of SHADED_ROWS) for (let c = 1; c <= 5; c++) {
      sheet.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECECEC" } };
    }
    for (const [r1, c1, r2, c2] of form.grids) {
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        sheet.getCell(r, c).border = { top: edge, bottom: edge, left: edge, right: edge };
      }
    }
    for (let r = 6; r <= 40; r++) {
      sheet.getCell(r, 1).border = { ...sheet.getCell(r, 1).border, left: edge };
      sheet.getCell(r, 5).border = { ...sheet.getCell(r, 5).border, right: edge };
    }
    for (const r of [6, 40]) for (let c = 1; c <= 5; c++) {
      sheet.getCell(r, c).border = { ...sheet.getCell(r, c).border, [r === 6 ? "top" : "bottom"]: edge };
    }
    for (const item of form.cells) {
      if (item.r <= 4) continue;
      if (item.rs || item.cs) sheet.mergeCells(item.r, item.c, item.r + (item.rs || 1) - 1, item.c + (item.cs || 1) - 1);
      const cell = sheet.getCell(item.r, item.c);
      cell.value = item.signature ? `_______________________________\n${item.value}` : item.value;
      cell.font = { name: "Arial", size: item.size || 10, bold: Boolean(item.bold || HEADER_ROWS.has(item.r)) };
      cell.alignment = { vertical: item.vertical || "middle", horizontal: item.money ? "right" : item.align || "left", shrinkToFit: !item.signature, wrapText: Boolean(item.signature || String(item.value).includes("\n")), indent: item.indent ? 3 : 0 };
      if (item.money) cell.numFmt = moneyFormat;
    }
    sheet.mergeCells("A1:B4");
    sheet.mergeCells("C1:E4");
    for (const address of ["A1", "C1"]) {
      sheet.getCell(address).border = { top: edge, bottom: edge, left: edge, right: edge };
    }
    sheet.getCell("C1").value = { richText: [
      { text: "MUNICIPALITY OF OPOL\n", font: { name: "Arial", size: 14, bold: true } },
      { text: "MUNICIPAL ECONOMIC ENTERPRISE OFFICE\n", font: { name: "Arial", size: 12 } },
      { text: "OPOL FISH PORT\n", font: { name: "Arial", size: 14, bold: true } },
      { text: TITLE, font: { name: "Arial", size: 10, bold: true } },
    ] };
    sheet.getCell("C1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    if (logoId !== null) {
      const dimensions = new DataView(header.buffer, header.byteOffset, header.byteLength);
      const imageWidth = dimensions.getUint32(16);
      const imageHeight = dimensions.getUint32(20);
      const boxWidth = form.widths.slice(0, 2).reduce((sum, col) => sum + Math.floor(col * 7 + 5), 0);
      const boxHeight = form.rowHeights.slice(0, 4).reduce((sum, height) => sum + height, 0) * 4 / 3;
      const scale = Math.min((boxWidth - 24) / imageWidth, (boxHeight - 24) / imageHeight);
      sheet.addImage(logoId, { tl: { col: 0.12, row: 0.35 }, ext: { width: imageWidth * scale, height: imageHeight * scale }, editAs: "oneCell" });
    }
    sheet.pageSetup.printArea = "A1:E40";
  }
  return new Blob([await workbook.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
