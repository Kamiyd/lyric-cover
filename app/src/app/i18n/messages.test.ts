import { describe, expect, it } from "vitest";
import { translateSongStatus, translateUiText } from "./messages";

describe("interface language", () => {
  it("interface language preserves canonical values and translates display copy", () => {
    expect(translateUiText("Export PNG", "zh-CN")).toBe("导出 PNG");
    expect(translateUiText("Export PNG", "en")).toBe("Export PNG");
    expect(translateUiText("Toggle Cover & Lyrics section", "zh-CN")).toBe("展开或收起封面与歌词");
    expect(translateUiText("Edit Density value", "zh-CN")).toBe("编辑文字密度");
    expect(translateUiText("Unknown message", "zh-CN")).toBe("Unknown message");
  });
  it("translates status templates without translating the song name", () => {
    expect(translateSongStatus("Loaded Background", "zh-CN")).toBe("已载入 Background");
    expect(translateSongStatus("3 results · ↑↓ to choose, Enter to pick", "zh-CN")).toBe("3 个结果 · ↑↓ 选择，回车确认");
  });
});
