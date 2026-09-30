import type { SongLanguage } from "./song-types";

export type ScriptConverter = (text: string) => string;

const identity: ScriptConverter = (text) => text;
let traditionalToSimplified: Promise<ScriptConverter> | null = null;

/** Loads OpenCC's Taiwan → Simplified converter once; falls back to identity if it fails. */
export function loadTraditionalToSimplified(): Promise<ScriptConverter> {
  traditionalToSimplified ??= import("opencc-js/t2cn").then(
    (module) => module.Converter({ from: "tw", to: "cn" }),
    () => {
      traditionalToSimplified = null;
      return identity;
    },
  );
  return traditionalToSimplified;
}

/** 简体 shows TW-store names and lyrics in simplified script; other languages keep the source. */
export async function getScriptConverter(language: SongLanguage): Promise<ScriptConverter> {
  return language === "cn" ? loadTraditionalToSimplified() : identity;
}
