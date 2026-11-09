import type { LanguageCode } from "../store/languageStore";
import { translateText } from "../i18n/catalog";

export function translate(text: string, language: LanguageCode): string {
  return translateText(text, language);
}
