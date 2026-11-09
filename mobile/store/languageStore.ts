import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type LanguageCode = "en" | "tl" | "ceb";
export const LANGUAGE_OPTIONS: { value: LanguageCode; label: string }[] = [
  { value: "en", label: "English" },
  { value: "tl", label: "Tagalog" },
  { value: "ceb", label: "Cebuano" },
];
const normalizeLanguage = (value: string | null): LanguageCode =>
  value === "tl" || value === "ceb" ? value : "en";
const storageKey = (userId: number) => `opol:language:${userId}`;
let revision = 0;

type LanguageStore = {
  userId: number | null;
  language: LanguageCode;
  loaded: boolean;
  loadLanguage: (userId: number | null) => Promise<void>;
  setLanguage: (language: LanguageCode) => Promise<boolean>;
};

export const useLanguageStore = create<LanguageStore>((set, get) => ({
  userId: null,
  language: "en",
  loaded: false,
  loadLanguage: async (userId) => {
    if (get().userId === userId && get().loaded) return;
    const request = ++revision;
    set({ userId, language: "en", loaded: !userId });
    if (!userId) return;
    let language: LanguageCode = "en";
    try { language = normalizeLanguage(await AsyncStorage.getItem(storageKey(userId))); }
    catch { /* Keep English available when device storage cannot be read. */ }
    if (request === revision && get().userId === userId) set({ language, loaded: true });
  },
  setLanguage: async (value) => {
    const { userId, language: previous } = get();
    if (!userId) return false;
    const language = normalizeLanguage(value);
    const request = ++revision;
    set({ language, loaded: true });
    try {
      await AsyncStorage.setItem(storageKey(userId), language);
      return true;
    } catch {
      if (request === revision && get().userId === userId) set({ language: previous });
      return false;
    }
  },
}));
