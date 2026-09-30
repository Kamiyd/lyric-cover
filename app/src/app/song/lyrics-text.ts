const CREDIT_LINE =
  /^\s*(作词|作曲|编曲|作詞|編曲|制作人|製作人|监制|監製|词|曲|Lyrics?|Lyricist|Composer|Producer)\s*[:：]/iu;
const LRC_TIMESTAMP = /\[[^\]]*\]/gu;
const LATIN_OR_DIGIT = /[A-Za-z0-9]/u;

/** "旅行的意義 (Live)" → "旅行的意義"; used to query lyrics and show the caption title. */
export function cleanSongTitle(title: string): string {
  const cleaned = title
    .replace(/\s*[(（[【].*?[)）\]】]\s*/gu, " ")
    .replace(/\s+-\s+.*$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
  return cleaned || title.trim();
}

/** Plain lyrics from LRCLIB: prefer plain text, strip LRC timestamps and credit lines. */
export function tidyLyrics(plain: string | null | undefined, synced: string | null | undefined): string {
  const raw = plain?.trim() ? plain : (synced ?? "").replace(LRC_TIMESTAMP, "");
  return raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !CREDIT_LINE.test(line))
    .join("\n");
}

/**
 * The characters woven over the cover, in reading order.
 * Compact removes punctuation and symbols and keeps a single space only between two Latin
 * words, so CJK text runs glyph after glyph.
 */
export function weaveCharacters(text: string, compact: boolean): readonly string[] {
  let source = text.trim();
  if (source.length === 0) return [];
  if (compact) {
    source = source
      .replace(/[\p{P}\p{S}]+/gu, "")
      .replace(/\s+/gu, (match, offset: number, whole: string) =>
        LATIN_OR_DIGIT.test(whole[offset - 1] ?? "") &&
        LATIN_OR_DIGIT.test(whole[offset + match.length] ?? "")
          ? " "
          : "",
      );
  } else {
    source = source.replace(/\s*\n\s*/gu, " / ");
  }
  return Array.from(source.replace(/\s+/gu, " "));
}
