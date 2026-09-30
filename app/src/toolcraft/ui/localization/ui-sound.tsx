import * as React from "react";

type SoundPreference = Readonly<{
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}>;
const UiSoundContext = React.createContext<SoundPreference>({ enabled: true, setEnabled: () => {} });

function readSavedSound(key: string): boolean {
  try { return localStorage.getItem(key) !== "off"; }
  catch { return true; }
}

/** A per-app UI preference, separate from artwork, history and settings files. */
export function ToolcraftUiSoundProvider({ appId, children }: Readonly<{ appId: string; children: React.ReactNode }>) {
  const key = `toolcraft:${appId}:ui-sound`;
  const [enabled, updateEnabled] = React.useState<boolean>(() => readSavedSound(key));
  const setEnabled = React.useCallback((next: boolean) => {
    updateEnabled(next);
    try { localStorage.setItem(key, next ? "on" : "off"); } catch { /* Private mode can still switch for this session. */ }
  }, [key]);
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) updateEnabled(readSavedSound(key));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  const value = React.useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
  return <UiSoundContext.Provider value={value}>{children}</UiSoundContext.Provider>;
}

export function useToolcraftUiSound(): SoundPreference {
  return React.useContext(UiSoundContext);
}
