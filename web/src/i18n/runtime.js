import { createContext, createElement, useContext, Fragment } from "react";
import { useLanguageStore } from "../store/languageStore";
import { hasTranslation, translateText } from "./catalog";

const TranslationEnabled = createContext(true);
const RecordData = createContext(false);
const TEXT_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];
const NO_TEXT_TRANSLATION = new Set(["script", "style", "code", "pre", "textarea", "td"]);
const knownChild = (child) => Array.isArray(child) ? child.some(knownChild) : hasTranslation(child);
const translateChild = (child, language) => Array.isArray(child)
  ? child.map((item) => translateChild(item, language)) : translateText(child, language);

// Translate only displayed strings at React render time. Props such as value,
// keys, IDs, callbacks and data records retain their original English values.
// This adds no DOM wrappers and does not rewrite nodes behind React's back.
export function LocalizedHost({ tag, originalProps }) {
  const language = useLanguageStore((state) => state.language);
  const parentEnabled = useContext(TranslationEnabled);
  const parentRecord = useContext(RecordData);
  const record = tag === "td" || (parentRecord && tag !== "button");
  const enabled = parentEnabled && originalProps.translate !== "no" && !originalProps.contentEditable;
  let props = originalProps;
  if (enabled && language !== "en") {
    props = { ...props };
    if (!record && !NO_TEXT_TRANSLATION.has(tag)) props.children = translateChild(props.children, language);
    for (const attribute of TEXT_ATTRIBUTES) {
      if (attribute in props) props[attribute] = translateText(props[attribute], language);
    }
  }
  let element = createElement(tag, props);
  if (record !== parentRecord) element = createElement(RecordData.Provider, { value: record }, element);
  return enabled === parentEnabled ? element : createElement(TranslationEnabled.Provider, { value: enabled }, element);
}

export function needsLocalization(tag, props = {}) {
  if (tag === Fragment) return knownChild(props.children);
  if (typeof tag !== "string") return false;
  return tag === "td" || tag === "button" || props.translate === "no" || Boolean(props.contentEditable)
    || (!NO_TEXT_TRANSLATION.has(tag) && knownChild(props.children))
    || TEXT_ATTRIBUTES.some((attribute) => hasTranslation(props[attribute]));
}
