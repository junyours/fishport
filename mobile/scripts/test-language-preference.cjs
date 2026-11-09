/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { create } = require("zustand");

function loadFile(relative, mocks) {
  const filename = path.join(__dirname, "..", relative);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: false },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (id) => {
    if (!(id in mocks)) throw new Error(`Unexpected dependency: ${id}`);
    return mocks[id];
  } }, { filename });
  return exports;
}

function loadStore(saved = new Map(), overrides = {}) {
  const storage = {
    getItem: async (key) => saved.get(key) ?? null,
    setItem: async (key, value) => { saved.set(key, value); },
    ...overrides,
  };
  return loadFile("store/languageStore.ts", {
    "@react-native-async-storage/async-storage": { default: storage },
    zustand: { create },
  }).useLanguageStore;
}

test("English is the default; each account retains its language after sign-out and a fresh app session", async () => {
  const saved = new Map();
  const store = loadStore(saved);
  await store.getState().loadLanguage(1);
  assert.equal(store.getState().language, "en");
  assert.equal(await store.getState().setLanguage("tl"), true);
  await store.getState().loadLanguage(null);
  assert.equal(store.getState().language, "en");
  await store.getState().loadLanguage(2);
  assert.equal(store.getState().language, "en");
  await store.getState().setLanguage("ceb");
  await store.getState().loadLanguage(1);
  assert.equal(store.getState().language, "tl");
  const restarted = loadStore(saved);
  await restarted.getState().loadLanguage(2);
  assert.equal(restarted.getState().language, "ceb");
});

test("a slow preference read for the previous account cannot overwrite the new account", async () => {
  let resolveOld;
  const oldRead = new Promise((resolve) => { resolveOld = resolve; });
  const store = loadStore(new Map(), { getItem: (key) => key.endsWith(":1") ? oldRead : Promise.resolve("ceb") });
  const previous = store.getState().loadLanguage(1);
  await store.getState().loadLanguage(2);
  resolveOld("tl");
  await previous;
  assert.equal(store.getState().userId, 2);
  assert.equal(store.getState().language, "ceb");
});

test("storage failures retain the previous language and report that saving failed", async () => {
  const store = loadStore(new Map(), { setItem: async () => { throw new Error("Device storage unavailable"); } });
  await store.getState().loadLanguage(1);
  assert.equal(await store.getState().setLanguage("tl"), false);
  assert.equal(store.getState().language, "en");
});

test("profile and tab translations use the selected language while unknown text is preserved", () => {
  const mobileCatalog = loadFile("i18n/mobileCatalog.ts", {});
  const webCatalog = loadFile("i18n/webCatalog.ts", {});
  const catalog = loadFile("i18n/catalog.ts", { "./mobileCatalog": mobileCatalog, "./webCatalog": webCatalog });
  const { translate } = loadFile("utils/language.ts", { "../i18n/catalog": catalog });
  assert.equal(translate("Language", "en"), "Language");
  assert.equal(translate("Language", "tl"), "Wika");
  assert.equal(translate("Language", "ceb"), "Pinulongan");
  assert.equal(translate("Change Password", "ceb"), "Ilisi ang Password");
  assert.equal(translate("Notifications", "tl"), "Mga Abiso");
  assert.equal(translate("MV Test Boat", "ceb"), "MV Test Boat");
});
