/** Presentation-only translations; stored values, IDs and user content stay canonical. */
export type UiLanguage = "en" | "zh-CN";


export const chineseMessages: Readonly<Record<string, string>> = {
  "Settings": "设置",
  "Workspace": "工作区",
  "Canvas viewport": "画布视口",
  "Import Settings": "导入设置",
  "Export Settings": "导出设置",
  "Click to upload an image": "点击上传图片",
  "or drag it onto the canvas": "或将图片拖到画布上",
  "Click to upload an image. or drag it onto the canvas": "点击上传图片，或将图片拖到画布上",
  "Rotate image left": "向左旋转图片",
  "Rotate image right": "向右旋转图片",
  "Flip image horizontally": "水平翻转图片",
  "Flip image vertically": "垂直翻转图片",
  "Save State as Default": "保存为默认设置",
  "Save state as default": "保存为默认设置",
  "Reset": "重置",
  "Reset controls": "重置参数",
  "Reset all controls": "重置所有参数",
  "Collapse controls": "收起参数面板",
  "Expand controls": "展开参数面板",
  "Background": "背景",
  "Background color": "背景颜色",
  "Infinity canvas": "无限画布",
  "Workspace background": "工作区背景",
  "Blanc": "纯色",
  "Blank": "纯色",
  "Dots": "网点",
  "Aspect ratio": "画布比例",
  "Canvas width": "画布宽度",
  "Canvas height": "画布高度",
  "Resolution scale": "预览精度",
  "Increases raster canvas backing resolution without changing the visible output size.": "提高画布预览清晰度，不改变作品尺寸。",
  "Custom": "自定义",
  "Square": "正方形",
  "Portrait": "竖版",
  "Landscape": "横版",
  "Width": "宽度",
  "Height": "高度",
  "Song": "歌曲",
  "Search": "搜索",
  "Search a song": "搜索歌曲",
  "Song or artist": "歌曲或歌手",
  "Type a song or artist": "输入歌曲名或歌手名",
  "Search results": "搜索结果",
  "Language": "歌曲语言",
  "Searching…": "正在搜索…",
  "Fetching lyrics…": "正在获取歌词…",
  "Using the uploaded cover": "正在使用上传的封面",
  "iTunes is unreachable. Check the connection and try again.": "暂时无法连接 iTunes，请检查网络后重试。",
  "No songs found. Try the title alone.": "未找到歌曲，试试只输入歌曲名。",
  "Search failed.": "搜索失败，请重试。",
  "LRCLIB is unreachable right now. Paste the lyrics or pick again.": "暂时无法连接 LRCLIB，请粘贴歌词或重新选择歌曲。",
  "Instrumental — add your own words in Lyrics.": "这是一首纯音乐，可以在“歌词”中填写自己的文字。",
  "No lyrics on LRCLIB for this song. Paste them in Lyrics.": "LRCLIB 暂无这首歌的歌词，请手动粘贴到“歌词”中。",
  "Searches iTunes for the song. Picking a result sets the cover, caption and lyrics (from LRCLIB) in one step and replaces an uploaded cover.": "从 iTunes 搜索歌曲。选择后自动填入封面、题注和 LRCLIB 歌词，并替换已上传的封面。",
  "Chooses the iTunes store for search results: 简体 and 繁體 use Chinese store names (简体 converted from traditional), English uses the US store.": "选择歌曲搜索地区和文字：简体、繁體使用中文商店，简体会转换繁体文字；English 使用美国商店。",
  "Cover & Lyrics": "封面与歌词",
  "Cover": "封面",
  "Lyrics": "歌词",
  "An uploaded cover replaces the searched cover.": "上传的图片会替换搜索得到的封面。",
  "Upload image": "上传图片",
  "Upload images": "上传图片",
  "Drop image here": "将图片拖到这里",
  "Drop files here": "将文件拖到这里",
  "or click to upload": "或点击上传",
  "Click to upload": "点击上传",
  "Choose files": "选择文件",
  "Choose folder": "选择文件夹",
  "Remove": "移除",
  "Image transforms": "图片变换",
  "Remove image": "移除图片",
  "Rotate left": "向左旋转",
  "Rotate right": "向右旋转",
  "90° Right": "向右旋转 90°",
  "Flip H": "水平翻转",
  "Flip V": "垂直翻转",
  "Flip horizontal": "水平翻转",
  "Flip vertical": "垂直翻转",
  "Weave": "排字样式",
  "Density": "文字密度",
  "Saturation": "色彩饱和度",
  "Font": "字体",
  "Sans": "黑体",
  "Serif": "宋体",
  "Tone sizing": "明暗字号",
  "Tight text": "紧密排列",
  "Cover underlay": "封面底图",
  "Glyphs per row across the cover. Glyph count grows with the square of this value.": "每行排列的文字数量，总字数会随此值的平方增长。",
  "Pushes each glyph's sampled cover colour away from grey.": "提高文字从封面采样的色彩饱和度。",
  "Bright areas get larger glyphs and dark areas smaller ones (inverted on a light background), so the cover reads from a distance.": "亮部用大字，暗部用小字；浅色背景时反转，让远处看起来更像原封面。",
  "Removes punctuation and spaces so glyphs run edge to edge.": "去除标点和空格，让文字紧密排列。",
  "Shows the cover itself faintly beneath the glyphs.": "在文字下方叠加半透明原始封面。",
  "Caption": "底部题注",
  "Show strip": "显示题注",
  "Soft fade": "渐隐过渡",
  "Off: a solid strip under the title. On: the lyrics fade out softly into the background instead.": "关闭时题注下方是实色条；打开后歌词在题注上方逐渐淡出。",
  "Title": "歌曲名",
  "Artist": "歌手",
  "Adds a strip with the song title and artist along the bottom of the output.": "在作品底部添加歌曲名和歌手。",
  "A light background inverts tone sizing so dark cover areas get larger glyphs.": "浅色背景会反转明暗字号，让封面暗部使用更大的文字。",
  "Fills the preview and PNG behind the glyphs. Off exports a transparent PNG.": "填充文字后方的背景，关闭后可导出透明 PNG。",
  "Image Export": "图片导出",
  "Format": "格式",
  "Resolution": "分辨率",
  "Export PNG": "导出 PNG",
  "Export JPG": "导出 JPG",
  "Export image": "导出图片",
  "Exporting…": "正在导出…",
  "Undo": "撤销",
  "Redo": "重做",
  "Zoom out": "缩小",
  "Zoom in": "放大",
  "Light theme": "浅色主题",
  "Dark theme": "深色主题",
  "Center canvas": "画布居中",
  "Controls": "参数",
  "Collapse": "收起",
  "Expand": "展开",
  "Close": "关闭",
  "Cancel": "取消",
  "Copy": "复制",
  "Paste": "粘贴",
  "Opacity": "不透明度",
  "Color": "颜色",
  "Hex": "十六进制",
  "Saving paused": "已暂停保存",
  "Reload saved workspace": "重新加载已保存的工作区",
  "Desktop app required": "请在电脑上打开",
  "This app is designed for desktop use. Open it on a desktop or laptop with a window at least 1024px wide.": "请在台式机或笔记本电脑上打开，并将窗口宽度调整到至少 1024 像素。",
};

export function translateUiText(text: string, language: UiLanguage): string {
  if (language === "en") return text;
  const trimmed = text.trim();
  const translated = chineseMessages[trimmed];
  if (translated) return text.replace(trimmed, translated);
  const fileAction = /^(Replace|Remove) (.+)$/.exec(trimmed);
  if (fileAction) return `${fileAction[1] === "Replace" ? "替换" : "移除"} ${fileAction[2]}`;
  const section = /^(Toggle|Reset|Collapse|Expand) (.+) section$/.exec(trimmed);
  if (section && chineseMessages[section[2]]) {
    const verb = { Toggle: "展开或收起", Reset: "重置", Collapse: "收起", Expand: "展开" }[section[1]];
    return `${verb}${chineseMessages[section[2]]}`;
  }
  const help = /^(.+) help$/.exec(trimmed);
  if (help && chineseMessages[help[1]]) return `${chineseMessages[help[1]]}说明`;
  const edit = /^Edit (.+) value$/.exec(trimmed);
  if (edit && chineseMessages[edit[1]]) return `编辑${chineseMessages[edit[1]]}`;
  const pick = /^Pick (.+)$/.exec(trimmed);
  if (pick && chineseMessages[pick[1]]) return `选择${chineseMessages[pick[1]]}`;
  const hex = /^(.+) hex$/.exec(trimmed);
  if (hex && chineseMessages[hex[1]]) return `${chineseMessages[hex[1]]}色值`;
  return text;
}

/** Only used for app-owned status copy, never for song titles or other user content. */
export function translateSongStatus(text: string, language: UiLanguage): string {
  if (language === "en") return text;
  const results = /^(\d+) results · ↑↓ to choose, Enter to pick$/.exec(text);
  if (results) return `${results[1]} 个结果 · ↑↓ 选择，回车确认`;
  if (text.startsWith("Loaded ")) return `已载入 ${text.slice(7)}`;
  return translateUiText(text, language);
}
