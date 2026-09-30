# Lyric Cover

[English](README.md) | 简体中文

用一首歌的歌词，把它的专辑封面重新排出来。

每个字取封面上对应位置的颜色：远看是封面，近看是歌词。

## 为什么做这个

看到有人用专辑封面做花束，才发现"把喜欢的专辑变成一件能送人的东西"这么能提供情绪价值。Lyric Cover 是同一个念头的数字版：不用花，用这首歌自己的词。

## 怎么用

1. 先选歌曲语言，再搜一首歌；或者自己上传封面、粘贴歌词。
2. 调文字密度、饱和度、字体，决定要不要在底部显示歌名和歌手。
3. 导出 PNG 或 JPG（2K / 4K / 8K），文件名是"歌名-歌手"。

歌曲语言可以选简体、繁體或 English，歌名、歌手和歌词会用对应的文字。界面本身可以在中文和英文之间切换。首次访问时会根据浏览器语言选择中英文；手动切换后的选择会保存在本地，并优先于浏览器语言。

## 运行

```bash
cd app
pnpm install
pnpm dev
```

需要联网：封面来自 iTunes Search，歌词来自 LRCLIB，字体来自 Google Fonts。

## 目录

应用在 `app/` 里，基于 Toolcraft；产品自己的代码在 `app/src/app/` 下。

## 分支

| 分支 | 区别 |
|---|---|
| `main` | 没有界面音效 |
| `sound` | `main` 加上界面音效，其余完全相同 |

和声音无关的修改都先做在 `main` 上，再合并到 `sound`。

## 开发

```bash
cd app
pnpm test                                  # 类型检查和 src 下的单元测试
pnpm exec playwright install chromium      # 首次运行浏览器测试前安装
pnpm test:browser                          # 应用浏览器测试（串行）
pnpm build                                 # 生产构建
```

`pnpm test:browser` 覆盖应用控件、歌曲流程和界面语言；音效分支还包含音效测试。命令已设置 `--workers=1`，避免并行首次加载超时。`pnpm test` 保留 `src` 下的应用和框架单元测试，不运行上游签名完整性校验。

## 数据来源与版权

- 封面和歌曲信息来自 [iTunes Search API](https://performance-partners.apple.com/search-api)，歌词来自 [LRCLIB](https://lrclib.net)，字体来自 Google Fonts。这些请求都由你的浏览器直接发出，本项目没有自己的服务器；设置、工作状态和上传素材会保存在你的浏览器本地，以便刷新后恢复。清除本站浏览器数据会删除这些本地记录。
- 专辑封面和歌词的版权属于各自的权利人。本仓库不包含任何封面图片或歌词文本。用它生成的图片请只作个人欣赏和分享，商用前请自行取得授权。
- 上述接口都是第三方服务，可用性和使用条款以它们自己的说明为准。

## 关于 Toolcraft

`app/` 由 [Toolcraft](https://toolcraft.sh) 生成，其中 `app/src/toolcraft/` 是 Toolcraft 运行时的副本（MIT，见 `app/LICENSE.md` 和 `app/NOTICE.md`）。

这份副本做过本地修改：

- 工具栏里的界面语言切换，以及一个很小的本地化层；
- 可以关闭无限画布的选项；
- 画布和工具栏在参数面板旁边的可用区域里居中，工具栏缩放保持这个中心；
- 导出进行时，导出按钮显示等待状态，底部进度线加粗；
- 导出文件名可以取自应用状态，并保留非拉丁字符。

因为这些修改，Toolcraft 原始签名完整性校验会报告与上游副本的差异。这不是应用功能测试，也不代表本地副本获得了上游认证。

- `pnpm test:toolcraft:integrity`：单独检查原始完整性，当前预期失败。
- `pnpm test:toolcraft`：保留原来的完整验证命令，会在完整性检查处失败。
- `pnpm test:toolcraft:browser`：保留原来的框架浏览器测试命令。
- `pnpm verify:delivery`：原始交付验证同样受完整性检查限制。

上游校验器和签名清单保持原样；日常开发使用上面的 `pnpm test`、`pnpm test:browser` 和 `pnpm build`。

## 界面音效（本分支）

这个分支用 [cuelume](https://github.com/danielwh2/cuelume)（MIT）加了简短的合成界面音效：开关、选项和滑杆刻度、打字按键，以及封面织完、导出完成、出错时的提示音。底部工具栏的喇叭按钮可以静音，设置会被记住。

依赖 `cuelume@0.2.4`。如果你用的 npm 镜像还没有同步这个版本，请从官方源安装：`pnpm install --registry https://registry.npmjs.org/`。

本分支对 Toolcraft 副本的额外修改：工具栏里的音效偏好和静音按钮、工具栏与导出按钮上的 `data-cuelume-tap`、公开导出状态的接口。

## 许可

本项目自身的代码以 [MIT 许可](LICENSE)发布。第三方代码各自遵循其许可。
