import * as React from "react";
import { createToolcraftUiLocalization, type ToolcraftUiTranslator } from "./ui-localization";

type UiLocalizationOptions = Readonly<{
  language: string;
  title: string;
  translate: ToolcraftUiTranslator;
}>;

/** One owner per app document. Portals share the same language without remounting. */
export function useToolcraftUiLocalization({ language, title, translate }: UiLocalizationOptions): void {
  const presentation = React.useRef<ReturnType<typeof createToolcraftUiLocalization> | null>(null);
  React.useLayoutEffect(() => {
    const previousLanguage = document.documentElement.lang;
    const previousTitle = document.title;
    const adapter = createToolcraftUiLocalization(document.body);
    presentation.current = adapter;
    return () => {
      adapter.dispose();
      presentation.current = null;
      document.documentElement.lang = previousLanguage;
      document.title = previousTitle;
    };
  }, []);
  React.useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.title = translate(title);
    presentation.current?.update(translate);
  }, [language, title, translate]);
}
