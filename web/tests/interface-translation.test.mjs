import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";
import { interfacePhrases } from "./interface-phrases.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

async function withLanguage(language, check) {
  globalThis.sessionStorage = { getItem: () => JSON.stringify({ user_id: 12 }) };
  globalThis.localStorage = { getItem: () => language, setItem() {}, removeItem() {} };
  const server = await createServer({ root, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom", logLevel: "error" });
  try {
    const runtime = await server.ssrLoadModule("/src/i18n/jsx-runtime.js");
    const catalog = await server.ssrLoadModule("/src/i18n/catalog.js");
    await check({ server, ...runtime, ...catalog });
  } finally {
    await server.close();
    delete globalThis.sessionStorage;
    delete globalThis.localStorage;
  }
}

test("Tagalog translates real JSX screens and controls, preserving field values and opt-outs", async () => {
  await withLanguage("tl", async ({ server, jsx, jsxs, translateText }) => {
    const { default: TitlePage } = await server.ssrLoadModule("/src/components/TitlePage.jsx");
    const title = renderToStaticMarkup(jsx(TitlePage, { title: "Settings" }));
    assert.match(title, /Mga Setting/);
    assert.match(renderToStaticMarkup(jsx("button", { children: "Save" })), /I-save/);
    const input = renderToStaticMarkup(jsx("input", { placeholder: "Search...", defaultValue: "Dashboard" }));
    assert.match(input, /placeholder="Maghanap\.\.\."/);
    assert.match(input, /value="Dashboard"/);
    const table = renderToStaticMarkup(jsx("table", { children: jsx("tbody", { children: jsx("tr", { children: jsx("td", {
      children: jsxs("div", { children: [jsx("span", { children: "Dashboard" }), jsx("button", { children: jsx("span", { children: "Edit" }) })] }),
    }) }) }) }));
    assert.match(table, /<span>Dashboard<\/span>/);
    assert.match(table, /<span>I-edit<\/span>/);
    const protectedText = renderToStaticMarkup(jsx("div", { translate: "no", children: jsx("span", { children: "Settings" }) }));
    assert.match(protectedText, /Settings/);
    assert.equal(translateText("REF-2026-001", "tl"), "REF-2026-001");
    assert.equal(translateText("  SAVE  ", "tl"), "  I-SAVE  ");
  });
});

test("Cebuano translates report navigation while keeping the report keys unchanged", async () => {
  await withLanguage("ceb", async ({ server, jsx, translateText }) => {
    const { default: ReportSidebar, REPORT_TABS } = await server.ssrLoadModule("/src/layout/ReportsInnerSidebar.jsx");
    const markup = renderToStaticMarkup(jsx(ReportSidebar, { activeKey: "collections" }));
    assert.match(markup, /Mga Koleksyon/);
    assert.match(markup, /Koleksyon ug mga Deposito/);
    assert.equal(REPORT_TABS.find((tab) => tab.key === "collection-deposit").label, "Collection & Deposits");
    assert.equal(translateText("Please select a day.", "ceb"), "Palihog pagpili og adlaw.");
    assert.equal(translateText("Name supplied by user", "ceb"), "Name supplied by user");
  });
});

test("English renders the original interface text and table rows can still be added and removed", async () => {
  await withLanguage("en", async ({ jsx }) => {
    const button = renderToStaticMarkup(jsx("button", { children: "Save" }));
    assert.equal(button, "<button>Save</button>");
    for (const values of [[], ["Dashboard"], ["Dashboard", "Settings"], []]) {
      const markup = renderToStaticMarkup(jsx("table", { children: jsx("tbody", { children: values.map((value, i) => jsx("tr", {
        children: jsx("td", { children: value }),
      }, i)) }) }));
      assert.equal((markup.match(/<td>/g) || []).length, values.length);
    }
  });
});

for (const language of ["tl", "ceb"]) {
  test(`${language} translates web cards, subtitles, search controls and filter choices without changing data`, async () => {
    await withLanguage(language, async ({ server, jsx, jsxs, translateText, hasTranslation }) => {
      const { default: Overview } = await server.ssrLoadModule("/src/components/Overview.jsx");
      const { default: TitlePage } = await server.ssrLoadModule("/src/components/TitlePage.jsx");
      const { default: FilterButton } = await server.ssrLoadModule("/src/components/FilterButton.jsx");
      const { default: FilterSelect } = await server.ssrLoadModule("/src/components/FilterSelect.jsx");
      const fragments = ["Total Banyera Records", "Track live banyera activities.", "Search for boat name, boat type, date, total", "Add Banyera"];
      const markup = renderToStaticMarkup(jsxs("section", { children: [
        jsx(Overview, { title: fragments[0], value: 123 }),
        jsx(TitlePage, { title: "Banyera", subtitle: fragments[1] }),
        jsx("input", { placeholder: fragments[2], defaultValue: "Active" }),
        jsx("button", { children: jsx("span", { children: fragments[3] }) }),
      ] }));
      for (const phrase of fragments) {
        assert.ok(hasTranslation(phrase), phrase);
        assert.notEqual(translateText(phrase, language), phrase);
        assert.ok(markup.includes(translateText(phrase, language)), phrase);
      }
      assert.match(markup, />123<|>123<\//);
      assert.match(markup, /value="Active"/);
      for (const [value, label] of [["all", "All Types"], ["all", "All Owners"], ["used", "Used"], ["week", "This Week"], ["Checked", "Checked"], ["info", "Info"]]) {
        const options = [{ value, label }];
        const filter = renderToStaticMarkup(jsx(FilterButton, { options, value }));
        assert.ok(filter.includes(translateText(label, language)), label);
        assert.equal(options[0].value, value);
        assert.equal(options[0].label, label);
      }
      const record = renderToStaticMarkup(jsx(FilterSelect, { value: 42, options: [{ value: 42, label: "Active" }] }));
      assert.match(record, /title="Active"/);
      assert.doesNotMatch(record, /title="Aktibo"/);
    });
  });
}

test("literal web buttons, card headings, subtitles and search/filter labels have translations", async () => {
  await withLanguage("tl", async ({ hasTranslation }) => {
    const missing = interfacePhrases(root).filter((phrase) => !hasTranslation(phrase));
    assert.deepEqual(missing, []);
  });
});
