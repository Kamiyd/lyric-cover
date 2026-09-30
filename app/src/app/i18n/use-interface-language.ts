import * as React from "react";
import { useToolcraftUiLocalization, useToolcraftUiLanguage } from "@/toolcraft/ui";
import { translateUiText } from "./messages";

/** The framework stores the UI preference; framework UI owns presentation updates. */
export function useInterfaceLanguage(): void {
  const { language } = useToolcraftUiLanguage();
  const translate = React.useCallback((text: string) => translateUiText(text, language), [language]);
  useToolcraftUiLocalization({ language, title: "Lyric Cover", translate });
}
