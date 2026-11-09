import assert from "node:assert/strict";
import { test } from "node:test";
import axios from "axios";
import { receiptImageError, savePaymentRequest } from "../src/lib/paymentReceipt.js";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("receipt upload is optional and accepts only supported images up to 10 MB", () => {
  assert.equal(receiptImageError(null), "");
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.equal(receiptImageError({ type, size: 10 * 1024 * 1024 }), "");
  assert.match(receiptImageError({ type: "image/png", size: 10 * 1024 * 1024 + 1 }), /10 MB/);
  assert.match(receiptImageError({ type: "image/svg+xml", size: 20 }), /JPG, PNG, or WebP/);
});

test("multipart creation preserves images, selected bills, receipt numbers and fiscal-year dates", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
  try {
  const { applyFiscalYearToPayloadDates } = await server.ssrLoadModule("/src/lib/fiscalYear.js");
  let sent;
  const api = axios.create({ env: { FormData: globalThis.FormData }, adapter: async (config) => { sent = config; return { data: {}, status: 201, statusText: "Created", headers: {}, config }; } });
  api.interceptors.request.use((config) => ({ ...config, data: applyFiscalYearToPayloadDates(config.data, "2026") }));
  const image = new File(["receipt"], "receipt.png", { type: "image/png" });
  await savePaymentRequest(api, { payment_scope: "selected_bills", bill_ids: [1, 2], official_receipt_no: "0012345", payment_date: "2025-11-09", amount_paid: 25, official_receipt_image: image });
  assert.equal(sent.method, "post");
  assert.equal(sent.data.get("official_receipt_no"), "0012345");
  assert.equal(sent.data.get("payment_date"), "2026-11-09");
  assert.deepEqual(sent.data.getAll("bill_ids[]"), ["1", "2"]);
  assert.equal(sent.data.get("official_receipt_image").name, "receipt.png");
  assert.equal(await sent.data.get("official_receipt_image").text(), "receipt");
  } finally { await server.close(); }
});

test("image-only edits use PHP multipart method spoofing; edits without an image keep JSON PUT", async () => {
  const calls = [];
  const api = {
    post: async (...args) => { calls.push(["post", ...args]); },
    put: async (...args) => { calls.push(["put", ...args]); },
  };
  const image = new File(["receipt"], "replacement.jpg", { type: "image/jpeg" });
  await savePaymentRequest(api, { official_receipt_no: "0012345", official_receipt_image: image }, 10);
  assert.equal(calls[0][0], "post");
  assert.equal(calls[0][1], "/payments/10");
  assert.equal(calls[0][2]._method, "PUT");
  assert.equal(calls[0][2].official_receipt_image, image);
  await savePaymentRequest(api, { official_receipt_no: "0012345", remarks: "Edited" }, 10);
  assert.equal(calls[1][0], "put");
  assert.ok(!("official_receipt_image" in calls[1][2]));
});
