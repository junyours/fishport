import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

// Audit the literal copy used for web controls and page summaries. Keep data
// expressions and printed report templates out of the interface catalogue.
export function interfacePhrases(root) {
  const phrases = new Set();
  const add = (text) => {
    const cleaned = text?.replace(/\s+/g, " ").trim();
    if (cleaned && /[a-zA-Z]/.test(cleaned) && !/^#[\da-f]{6}$/i.test(cleaned) && !["09XXXXXXXXX", "email@example.com"].includes(cleaned)) phrases.add(cleaned);
  };
  const displayValue = (value) => {
    if (value?.type === "StringLiteral") add(value.value);
    if (value?.type === "ConditionalExpression") {
      displayValue(value.consequent);
      displayValue(value.alternate);
    }
  };
  function visit(node, parent, inButton = false) {
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXAttribute" && ["title", "subtitle", "placeholder", "saveLabel", "confirmText", "cancelText", "buttonText"].includes(node.name.name)) {
      const value = node.value?.type === "JSXExpressionContainer" ? node.value.expression : node.value;
      displayValue(value);
    }
    if (node.type === "ObjectProperty" && ["label", "title", "subtitle", "placeholder"].includes(node.key.name ?? node.key.value)) displayValue(node.value);
    if (node.type === "VariableDeclarator" && /SUBTITLE/i.test(node.id?.name ?? "")) displayValue(node.init);
    const button = inButton || (node.type === "JSXElement" && node.openingElement.name.name === "button");
    if (node.type === "JSXText" && button) add(node.value);
    if (node.type === "JSXExpressionContainer" && button) displayValue(node.expression);
    for (const [key, value] of Object.entries(node)) {
      if (["loc", "start", "end", "comments", "tokens"].includes(key)) continue;
      if (Array.isArray(value)) value.forEach((child) => visit(child, node, button));
      else if (value && typeof value === "object") visit(value, node, button);
    }
  }
  function scan(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) scan(filename);
      else if (/\.jsx$/.test(filename)) visit(parse(fs.readFileSync(filename, "utf8"), { sourceType: "module", plugins: ["jsx"] }));
    }
  }
  scan(path.join(root, "src/pages/rbac"));
  scan(path.join(root, "src/components"));
  return [...phrases].sort();
}
