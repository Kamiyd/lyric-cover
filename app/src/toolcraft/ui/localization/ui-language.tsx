import * as React from "react";

export type ToolcraftUiLanguage = "en" | "zh-CN";
type LanguagePreference = Readonly<{
  language: ToolcraftUiLanguage;
  setLanguage: (language: ToolcraftUiLanguage) => void;
}>;
const UiLanguageContext = React.createContext<LanguagePreference>({ language: "en", setLanguage: () => {} });

function readSavedLanguage(key: string): ToolcraftUiLanguage {
  try { return localStorage.getItem(key) === "zh-CN" ? "zh-CN" : "en"; }
  catch { return "en"; }
}

/** A per-app UI preference, separate from artwork, history and settings files. */
export function ToolcraftUiLanguageProvider({ appId, children }: Readonly<{ appId: string; children: React.ReactNode }>) {
  const key = `toolcraft:${appId}:ui-language`;
  const [language, updateLanguage] = React.useState<ToolcraftUiLanguage>(() => readSavedLanguage(key));
  const setLanguage = React.useCallback((next: ToolcraftUiLanguage) => {
    updateLanguage(next);
    try { localStorage.setItem(key, next); } catch { /* Private mode can still switch for this session. */ }
  }, [key]);
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) updateLanguage(readSavedLanguage(key));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  const value = React.useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <UiLanguageContext.Provider value={value}>{children}</UiLanguageContext.Provider>;
}

export function useToolcraftUiLanguage(): LanguagePreference {
  return React.useContext(UiLanguageContext);
}
