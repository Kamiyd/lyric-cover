export const WEAVE_FONTS = ["sans", "serif"] as const;
export type WeaveFont = (typeof WEAVE_FONTS)[number];

export const WEAVE_DENSITY = { defaultValue: 84, max: 160, min: 40, step: 2 } as const;
export const WEAVE_SATURATION = { defaultValue: 1.3, max: 2, min: 0.6, step: 0.05 } as const;
export const WEAVE_UNDERLAY = { defaultValue: 0, max: 100, min: 0, step: 1 } as const;
export const WEAVE_DEFAULT_BACKGROUND = "#0B0B0B";

export const WEAVE_TARGETS = {
  artist: "caption.artist",
  background: "appearance.background",
  captionEnabled: "caption.enabled",
  captionFade: "caption.fade",
  compact: "weave.compact",
  cover: "source.cover",
  density: "weave.density",
  font: "weave.font",
  language: "song.language",
  lyrics: "song.lyrics",
  pick: "song.pick",
  saturation: "weave.saturation",
  title: "caption.title",
  toneSize: "weave.toneSize",
  underlay: "weave.underlay",
} as const;

export type WeaveGlyphParams = Readonly<{
  compact: boolean;
  density: number;
  font: WeaveFont;
  lyrics: string;
  lightBackground: boolean;
  saturation: number;
  toneSize: boolean;
}>;

export type WeaveCaptionParams = Readonly<{
  artist: string;
  enabled: boolean;
  /** true: the weave fades out under the caption; false: a solid strip cuts it. */
  fade: boolean;
  textColor: string;
  title: string;
}>;

export type WeaveParams = Readonly<{
  caption: WeaveCaptionParams;
  glyphs: WeaveGlyphParams;
  underlay: number;
}>;

type Values = Readonly<Record<string, unknown>>;

function numberIn(value: unknown, range: Readonly<{ defaultValue: number; max: number; min: number }>): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(range.max, Math.max(range.min, value))
    : range.defaultValue;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Relative luminance of a #RRGGBB colour in 0..1. */
export function hexLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/iu.exec(hex.trim());
  if (!match) return 0;
  const channel = (offset: number) => {
    const value = Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

export function readWeaveParams(values: Values): WeaveParams {
  const background = text(values[WEAVE_TARGETS.background]) || WEAVE_DEFAULT_BACKGROUND;
  const lightBackground = hexLuminance(background) > 0.4;
  const font = values[WEAVE_TARGETS.font] === "serif" ? "serif" : "sans";
  return {
    caption: {
      artist: text(values[WEAVE_TARGETS.artist]).trim(),
      enabled: values[WEAVE_TARGETS.captionEnabled] !== false,
      fade: values[WEAVE_TARGETS.captionFade] === true,
      textColor: lightBackground ? "#1A1A1A" : "#ECE9E1",
      title: text(values[WEAVE_TARGETS.title]).trim(),
    },
    glyphs: {
      compact: values[WEAVE_TARGETS.compact] !== false,
      density: Math.round(numberIn(values[WEAVE_TARGETS.density], WEAVE_DENSITY)),
      font,
      lightBackground,
      lyrics: text(values[WEAVE_TARGETS.lyrics]),
      saturation: numberIn(values[WEAVE_TARGETS.saturation], WEAVE_SATURATION),
      toneSize: values[WEAVE_TARGETS.toneSize] !== false,
    },
    underlay: numberIn(values[WEAVE_TARGETS.underlay], WEAVE_UNDERLAY) / 100,
  };
}

export const WEAVE_EXPORT_BASE_NAME = "lyric-cover";

/**
 * The download name: "title-artist" from the caption fields, which hold the song in the chosen
 * language. Falls back to the title or artist alone, then to a generic name.
 */
export function weaveExportBaseName(values: Values): string {
  const { artist, title } = readWeaveParams(values).caption;
  return [title, artist].filter((part) => part.length > 0).join("-") || WEAVE_EXPORT_BASE_NAME;
}
