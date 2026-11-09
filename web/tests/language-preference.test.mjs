import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { create } from "zustand";

async function loadPreference({ account = 1, saved = new Map(), storageFails = false } = {}) {
  let currentAccount = account;
  const context = createContext({
    sessionStorage: { getItem: () => JSON.stringify({ user_id: currentAccount }) },
    localStorage: {
      getItem: (key) => { if (storageFails) throw new Error("Storage unavailable"); return saved.get(key) ?? null; },
      setItem: (key, value) => { if (storageFails) throw new Error("Storage unavailable"); saved.set(key, value); },
    },
  });
  const source = await readFile(new URL("../src/store/languageStore.js", import.meta.url), "utf8");
  const module = new SourceTextModule(source, { context });
  await module.link(() => new SyntheticModule(["create"], function () { this.setExport("create", create); }, { context }));
  await module.evaluate();
  return { store: module.namespace.useLanguageStore, options: module.namespace.LANGUAGE_OPTIONS, saved, account: (value) => { currentAccount = value; } };
}

test("language defaults to English and supports exactly English, Tagalog and Cebuano", async () => {
  const env = await loadPreference();
  assert.equal(env.store.getState().language, "en");
  assert.deepEqual(Array.from(env.options, (option) => option.label), ["English", "Tagalog", "Cebuano"]);
});

test("selection notifies both controls, persists across reloads and stays separate per account", async () => {
  const env = await loadPreference();
  const settings = [], topbar = [];
  env.store.subscribe((state) => settings.push(state.language));
  env.store.subscribe((state) => topbar.push(state.language));
  env.store.getState().setLanguage("tl");
  assert.equal(settings.at(-1), "tl");
  assert.equal(topbar.at(-1), "tl");
  const reloaded = await loadPreference({ saved: env.saved });
  assert.equal(reloaded.store.getState().language, "tl");
  env.account(2);
  env.store.getState().loadLanguage();
  assert.equal(env.store.getState().language, "en");
  env.store.getState().setLanguage("ceb");
  env.account(1);
  env.store.getState().loadLanguage();
  assert.equal(env.store.getState().language, "tl");
});

test("unsupported values and unavailable storage fall back safely", async () => {
  const env = await loadPreference({ saved: new Map([["opol:language:1", "invalid"]]), storageFails: true });
  assert.equal(env.store.getState().language, "en");
  env.store.getState().setLanguage("ceb");
  assert.equal(env.store.getState().language, "ceb");
  env.store.getState().setLanguage("invalid");
  assert.equal(env.store.getState().language, "en");
});

test("sign-out resets the public interface but preserves the account preference for the next login", async () => {
  const env = await loadPreference();
  env.store.getState().setLanguage("ceb");
  env.account(null);
  env.store.getState().loadLanguage();
  assert.equal(env.store.getState().account, "guest");
  assert.equal(env.store.getState().language, "en");
  assert.equal(env.saved.get("opol:language:1"), "ceb");
  env.account(2);
  env.store.getState().loadLanguage();
  assert.equal(env.store.getState().language, "en");
  env.store.getState().setLanguage("tl");
  env.account(1);
  env.store.getState().loadLanguage();
  assert.equal(env.store.getState().language, "ceb");
  const nextLogin = await loadPreference({ account: 1, saved: env.saved });
  assert.equal(nextLogin.store.getState().language, "ceb");
});
