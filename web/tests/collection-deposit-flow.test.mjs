import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

async function mountReport(storage = new Map()) {
  const hooks = [];
  const effects = [];
  const queries = [];
  const toasts = [];
  const excelExports = [];
  const cleanups = [];
  let cursor = 0;
  let urls = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], (value) => { hooks[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!(index in hooks) || deps.some((value, i) => value !== hooks[index][i])) effects.push(effect);
      hooks[index] = deps;
    },
  };
  const queryClient = { fetchQuery(options) {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    queries.push({ options, resolve });
    return promise;
  } };
  const dependencies = {
    react: { default: react, ...react },
    "@tanstack/react-query": { useQueryClient: () => queryClient },
    "../layout/ReportsInnerTopbar": { default: () => null },
    "../hooks/useRemittanceReportDataQuery": { getRemittanceReportQueryOptions: (options) => options },
    "../lib/exportCollectionDepositReport": {
      buildCollectionDepositPdf: async () => new Uint8Array([1, 2, 3]),
      buildCollectionDepositExcel: async (options) => { excelExports.push(options); return new Blob([]); },
    },
    "../store/bottomToastStore": { showBottomToast: (...args) => toasts.push(args) },
  };
  const context = createContext({
    Blob, URL: { createObjectURL: () => `blob:report-${++urls}`, revokeObjectURL() {} },
    document: { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } },
    setTimeout: () => 0,
    window: {
      sessionStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
      btoa: (value) => Buffer.from(value, "binary").toString("base64"),
      atob: (value) => Buffer.from(value, "base64").toString("binary"),
    },
  });
  const cacheSource = await readFile(new URL("../src/lib/collectionDepositCache.js", import.meta.url), "utf8");
  const cacheModule = new SourceTextModule(cacheSource, { context });
  const source = await readFile(new URL("../src/components/CollectionDepositReport.jsx", import.meta.url), "utf8");
  // Exercise the actual hooks and asynchronous handlers; omit only the JSX view.
  const module = new SourceTextModule(source.slice(0, source.lastIndexOf("  return <>")) + "return { date, busy, preview, changeDate, generate };\n}", { context });
  await module.link((specifier) => {
    if (specifier === "../lib/collectionDepositCache") return cacheModule;
    const values = dependencies[specifier];
    assert.ok(values, `Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
  const render = (fiscalYear = "2026") => {
    cursor = 0;
    const result = module.namespace.default({ fiscalYear });
    effects.splice(0).forEach((effect) => {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    });
    return result;
  };
  render();
  return { render, queries, toasts, excelExports, storage, unmount: () => cleanups.forEach((cleanup) => cleanup()) };
}

test("changing the date keeps the PDF open and only Generate PDF applies the new date", async () => {
  const env = await mountReport();
  env.render().changeDate([], "2026-09-14");
  assert.equal(env.queries.length, 0);
  const first = env.render().generate("pdf");
  assert.equal(env.render().busy, "pdf");
  env.queries[0].resolve({ rows: [] });
  await first;
  const originalPreview = env.render().preview;
  assert.ok(originalPreview);
  env.render().changeDate([], "2026-09-15");
  assert.equal(env.render().preview, originalPreview);
  assert.equal(env.queries.length, 1);
  const refresh = env.render().generate("pdf");
  assert.equal(env.render().preview, null);
  assert.equal(env.queries[1].options.selectedDate, "2026-09-15");
  env.render().changeDate([], "2026-09-16");
  assert.equal(env.queries.length, 2);
  env.queries[1].resolve({ rows: [] });
  await refresh;
  assert.match(env.render().preview.filename, /2026-09-15/);
  assert.equal(env.render().date, "2026-09-16");
});

test("Excel requires Generate PDF and exports the same data and date without refetching", async () => {
  const env = await mountReport();
  await env.render().generate("pdf");
  assert.equal(env.toasts.at(-1)[1], "Missing Filter");
  env.render().changeDate([], "2026-09-14");
  await env.render().generate("excel");
  assert.equal(env.toasts.at(-1)[1], "Report Required");
  assert.equal(env.queries.length, 0);
  const data = { rows: [{ amountToRemit: 100 }] };
  const pending = env.render().generate("pdf");
  env.queries[0].resolve(data);
  await pending;
  await env.render().generate("excel");
  assert.equal(env.queries.length, 1);
  assert.equal(env.excelExports[0].reportData, data);
  assert.equal(env.excelExports[0].date, "2026-09-14");
  env.render().changeDate([], "2026-09-15");
  await env.render().generate("excel");
  assert.equal(env.excelExports.length, 2);
  assert.equal(env.excelExports[1].date, "2026-09-14");
  assert.equal(env.queries.length, 1);
});

test("leaving and returning restores the date, PDF, and Excel snapshot without generating", async () => {
  const first = await mountReport();
  first.render().changeDate([], "2026-09-14");
  const pending = first.render().generate("pdf");
  first.queries[0].resolve({ rows: [{ amountToRemit: 100 }] });
  await pending;
  first.unmount();
  const returned = await mountReport(first.storage);
  assert.equal(returned.render().date, "2026-09-14");
  assert.ok(returned.render().preview);
  assert.equal(returned.queries.length, 0);
  await returned.render().generate("excel");
  assert.equal(returned.queries.length, 0);
  assert.equal(returned.excelExports[0].date, "2026-09-14");
  assert.equal(returned.excelExports[0].reportData.rows[0].amountToRemit, 100);
  returned.render("2025");
  assert.equal(returned.render("2025").date, "");
  assert.equal(returned.render("2025").preview, null);
  returned.render("2026");
  assert.ok(returned.render().preview);
});

test("returning restores the selected date and the PDF for the last generated date", async () => {
  const first = await mountReport();
  first.render().changeDate([], "2026-09-14");
  const pending = first.render().generate("pdf");
  first.queries[0].resolve({ rows: [] });
  await pending;
  first.render().changeDate([], "2026-09-15");
  first.unmount();
  const returned = await mountReport(first.storage);
  assert.equal(returned.render().date, "2026-09-15");
  assert.ok(returned.render().preview);
  assert.match(returned.render().preview.filename, /2026-09-14/);
  assert.equal(returned.queries.length, 0);
  await returned.render().generate("excel");
  assert.equal(returned.excelExports[0].date, "2026-09-14");
});
