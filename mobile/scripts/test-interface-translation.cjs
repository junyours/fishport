/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const os = require("node:os");
const ts = require("typescript");
const babel = require("@babel/core");
const parser = require("@babel/parser");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function createEnvironment(projectRoot = path.resolve(__dirname, "..")) {
  let language = "ceb", inputProps, nativeRef;
  const Text = React.forwardRef(function MockNativeText(props, ref) { return React.createElement("span", { ref }, props.children); });
  const TextInput = React.forwardRef(function MockNativeInput(props, ref) {
    inputProps = props; nativeRef = ref;
    return React.createElement("input", { placeholder: props.placeholder, defaultValue: props.value });
  });
  const modules = new Map();
  function load(filename) {
    assert.ok(filename && filename.startsWith(projectRoot + path.sep), "Translation imports must stay inside the mobile project");
    if (modules.has(filename)) return modules.get(filename);
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false },
    }).outputText;
    vm.runInNewContext(code, { exports, require: (id) => {
      if (id === "react-native") return { Text, TextInput };
      if (id.endsWith("store/languageStore")) return { useLanguageStore: (selector) => selector({ language }) };
      if (!id.startsWith(".")) return require(id);
      const base = path.resolve(path.dirname(filename), id);
      return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
    } }, { filename });
    modules.set(filename, exports);
    return exports;
  }
  const controls = load(path.join(projectRoot, "i18n/LocalizedText.tsx"));
  const catalog = load(path.join(projectRoot, "i18n/catalog.ts"));
  return { controls, catalog, language: (value) => { language = value; }, input: () => inputProps, ref: () => nativeRef };
}

test("mobile translations resolve from a standalone project without a sibling shared folder", () => {
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "mobile-language-standalone-"));
  try {
    for (const file of ["i18n/LocalizedText.tsx", "i18n/catalog.ts", "i18n/mobileCatalog.ts", "i18n/webCatalog.ts", "utils/language.ts"]) {
      const target = path.join(isolated, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.resolve(__dirname, "..", file), target);
    }
    const env = createEnvironment(isolated);
    assert.equal(env.catalog.translateText("Language", "ceb"), "Pinulongan");
    assert.match(renderToStaticMarkup(React.createElement(env.controls.Text, null, "Change Password")), /Ilisi ang Password/);
  } finally {
    if (path.dirname(isolated) === os.tmpdir() && path.basename(isolated).startsWith("mobile-language-standalone-")) {
      fs.rmSync(isolated, { recursive: true, force: true });
    }
  }
});

test("screen labels, messages, and dynamic counts translate in both languages and restore to English", () => {
  const env = createEnvironment();
  const element = React.createElement(env.controls.Text, null, "Today's Overview");
  assert.match(renderToStaticMarkup(element), /Kinatibuk-ang Tan-aw Karong Adlawa/);
  env.language("tl");
  assert.match(renderToStaticMarkup(element), /Buod Ngayong Araw/);
  assert.equal(env.catalog.translateText("Please complete the daily ticket form.", "tl"), "Kumpletuhin ang form ng arawang tiket.");
  assert.equal(env.catalog.translateText("Reprint (3)", "ceb"), "I-print Pag-usab (3)");
  assert.equal(env.catalog.translateText("Boat #42", "tl"), "Bangka #42");
  env.language("en");
  assert.match(renderToStaticMarkup(element), /Today&#x27;s Overview/);
});

test("record text opt-outs, form values, callbacks and native input refs stay unchanged", () => {
  const env = createEnvironment();
  assert.equal(renderToStaticMarkup(React.createElement(env.controls.Text, { localize: false }, "Home")), "<span>Home</span>");
  const ref = React.createRef();
  const onChangeText = () => {};
  const html = renderToStaticMarkup(React.createElement(env.controls.TextInput, { ref, value: "Home", placeholder: "Enter address", onChangeText }));
  assert.match(html, /placeholder="Isulod ang puy-anan"/);
  assert.equal(env.input().value, "Home");
  assert.equal(env.input().onChangeText, onChangeText);
  assert.equal(env.ref(), ref);
});

test("the app-wide Babel integration protects names without changing NativeWind's JSX runtime", () => {
  const source = 'import { Text, TextInput, View } from "react-native"; export function Example() { return <View><Text>{displayName}</Text><Text>{item.boat_name}</Text><Text>Home</Text><TextInput value={address} placeholder="Enter address" /></View>; }';
  const transformed = babel.transformSync(source, {
    filename: path.resolve(__dirname, "../app/language-example.tsx"),
    configFile: false, babelrc: false, parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [path.resolve(__dirname, "babel-localize.cjs")],
  }).code;
  assert.match(transformed, /i18n\/LocalizedText/);
  assert.match(transformed, /<Text localize=\{false\}>\{displayName\}/);
  assert.match(transformed, /<Text localize=\{false\}>\{item.boat_name\}/);
  assert.match(transformed, /<Text>Home<\/Text>/);
  assert.match(transformed, /value=\{address\}/);
  const compiled = babel.transformFileSync(path.resolve(__dirname, "../i18n/LocalizedText.tsx"), { configFile: path.resolve(__dirname, "../babel.config.js") }).code;
  assert.match(compiled, /react-native-css-interop\/jsx-runtime/);
});

test("mobile static interface labels and placeholders have shared translations", () => {
  const { catalog } = createEnvironment();
  const labels = new Set();
  const fixedNames = new Set(["OPOL FISH PORT", "Opol Fish", "Port", "AM", "PM", "N/A", "e.g. Opol, Misamis Oriental"]);
  const add = (text) => {
    const value = text.replace(/\s+/g, " ").trim();
    if (/[A-Za-z]{2}/.test(value) && !value.includes("@") && !/^\d/.test(value) && !fixedNames.has(value)) labels.add(value);
  };
  const walk = (node, parent) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXText") add(node.value);
    if (node.type === "StringLiteral" && (
      parent?.type === "JSXExpressionContainer"
      || (parent?.type === "JSXAttribute" && ["title", "placeholder", "accessibilityLabel"].includes(parent.name?.name))
      || (parent?.type === "ObjectProperty" && ["label", "title", "placeholder", "message", "description"].includes(parent.key?.name))
    )) add(node.value);
    for (const [key, value] of Object.entries(node)) {
      if (["loc", "extra"].includes(key)) continue;
      if (Array.isArray(value)) value.forEach((item) => walk(item, node));
      else if (value && typeof value === "object") walk(value, node);
    }
  };
  const scan = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (/\.tsx?$/.test(file)) walk(parser.parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["typescript", "jsx"] }));
    }
  };
  scan(path.resolve(__dirname, "../app"));
  scan(path.resolve(__dirname, "../components"));
  assert.ok(labels.size > 100);
  assert.deepEqual([...labels].filter((label) => !catalog.hasTranslation(label)), []);
});
