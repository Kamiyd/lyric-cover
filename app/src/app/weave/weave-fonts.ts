import type { WeaveFont } from "./weave-params";

/**
 * Glyphs use Noto Sans/Serif SC Black. The faces are registered with the FontFace API under
 * product-owned family names from the Google Fonts CSS, keeping every unicode-range subset so
 * only the characters in the lyrics are downloaded. System CJK fonts are the fallback.
 */
const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@500;900&family=Noto+Serif+SC:wght@900&display=swap";
const FAMILY_PREFIX = "Lyric Cover ";

const FALLBACK: Readonly<Record<WeaveFont, string>> = {
  sans: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  serif: '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif',
};

const REMOTE_FAMILY: Readonly<Record<WeaveFont, string>> = {
  sans: "Noto Sans SC",
  serif: "Noto Serif SC",
};

export function weaveFontFamily(font: WeaveFont): string {
  return `"${FAMILY_PREFIX}${REMOTE_FAMILY[font]}", ${FALLBACK[font]}`;
}

/** The caption artist line always uses the sans family at medium weight. */
export const CAPTION_ARTIST_FAMILY = weaveFontFamily("sans");

type ParsedFace = Readonly<{
  family: string;
  source: string;
  unicodeRange?: string;
  weight: string;
}>;

export function parseGoogleFontFaces(css: string): readonly ParsedFace[] {
  const faces: ParsedFace[] = [];
  for (const block of css.matchAll(/@font-face\s*\{([^}]*)\}/gu)) {
    const body = block[1];
    const family = /font-family:\s*['"]?([^;'"]+)['"]?\s*;/u.exec(body)?.[1]?.trim();
    const weight = /font-weight:\s*([^;]+);/u.exec(body)?.[1]?.trim();
    const url = /src:\s*url\(([^)]+)\)/u.exec(body)?.[1]?.trim();
    const unicodeRange = /unicode-range:\s*([^;]+);/u.exec(body)?.[1]?.trim();
    if (!family || !weight || !url) continue;
    faces.push({
      family,
      source: `url(${url})`,
      weight,
      ...(unicodeRange ? { unicodeRange } : {}),
    });
  }
  return faces;
}

let registration: Promise<boolean> | null = null;

function registerFaces(): Promise<boolean> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") {
    return Promise.resolve(false);
  }
  registration ??= fetch(GOOGLE_FONTS_CSS)
    .then((response) => (response.ok ? response.text() : ""))
    .then((css) => {
      const faces = parseGoogleFontFaces(css);
      for (const face of faces) {
        document.fonts.add(
          new FontFace(`${FAMILY_PREFIX}${face.family}`, face.source, {
            display: "swap",
            style: "normal",
            weight: face.weight,
            ...(face.unicodeRange ? { unicodeRange: face.unicodeRange } : {}),
          }),
        );
      }
      return faces.length > 0;
    })
    .catch(() => {
      registration = null;
      return false;
    });
  return registration;
}

/** Resolves once the glyphs in `text` are available (or known to use the fallback). */
export async function ensureWeaveFonts(
  font: WeaveFont,
  text: string,
  extraText = "",
): Promise<void> {
  if (!(await registerFaces())) return;
  const glyphs = Array.from(new Set(Array.from(`${text}${extraText}`))).join("");
  if (glyphs.length === 0) return;
  try {
    await Promise.all([
      document.fonts.load(`900 32px ${weaveFontFamily(font)}`, glyphs),
      extraText
        ? document.fonts.load(`500 32px ${CAPTION_ARTIST_FAMILY}`, extraText)
        : Promise.resolve([]),
    ]);
  } catch {
    // Missing subsets fall back to the system CJK family.
  }
}
