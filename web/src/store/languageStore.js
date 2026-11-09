import { create } from "zustand";

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "tl", label: "Tagalog" },
  { value: "ceb", label: "Cebuano" },
];

const normalizeLanguage = (value) => LANGUAGE_OPTIONS.some((option) => option.value === value) ? value : "en";
const userKey = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem("user") || "null");
    return String(user?.user_id ?? user?.id ?? "guest");
  } catch { return "guest"; }
};
const readLanguage = (account) => {
  if (account === "guest") return "en";
  try { return normalizeLanguage(localStorage.getItem(`opol:language:${account}`)); }
  catch { return "en"; }
};
const initialAccount = userKey();

export const useLanguageStore = create((set, get) => ({
  account: initialAccount,
  language: readLanguage(initialAccount),
  loadLanguage: (force = false) => {
    const account = userKey();
    if (!force && account === get().account) return;
    set({ account, language: readLanguage(account) });
  },
  setLanguage: (value) => {
    const account = userKey();
    const language = normalizeLanguage(value);
    if (account === "guest") return;
    try { localStorage.setItem(`opol:language:${account}`, language); }
    catch { /* The selection still works for this visit when storage is unavailable. */ }
    set({ account, language });
  },
}));
