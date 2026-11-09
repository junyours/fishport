import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLanguageStore } from "../store/languageStore";

export default function LanguagePreferenceBridge() {
  const { pathname } = useLocation();
  const language = useLanguageStore((state) => state.language);
  const loadLanguage = useLanguageStore((state) => state.loadLanguage);

  // Restore on login/logout and route changes, including expired sessions.
  useEffect(() => { loadLanguage(); }, [pathname, loadLanguage]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    const syncPreference = (event) => {
      const account = useLanguageStore.getState().account;
      if (event.key === `opol:language:${account}`) loadLanguage(true);
    };
    window.addEventListener("storage", syncPreference);
    return () => window.removeEventListener("storage", syncPreference);
  }, [loadLanguage]);
  return null;
}
