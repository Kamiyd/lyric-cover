import * as React from "react";
import { MagnifyingGlassIcon, CloudArrowUpIcon } from "@phosphor-icons/react";
import { useToolcraftControlNavigation, useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";
import { Button, Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, useToolcraftUiLanguage } from "@/toolcraft/ui";
import { resolveCoverSource } from "../weave/cover-source";
import { WEAVE_TARGETS } from "../weave/weave-params";
import { pickSong, runSongSearch } from "../song/song-actions";
import { getScriptConverter } from "../song/chinese-script";

export function EmptyCanvasGuide() {
  const { language } = useToolcraftUiLanguage();
  const zh = language === "zh-CN";
  const dispatch = useToolcraftDispatch();
  const navigate = useToolcraftControlNavigation();
  const values = useToolcraftSelector(state => state.values);
  const media = useToolcraftSelector(state => state.mediaAssets);
  const cover = resolveCoverSource(media, values);
  const lyrics = String(values[WEAVE_TARGETS.lyrics] ?? "").trim();
  const uploading = media.some(asset => asset.sourceTarget === WEAVE_TARGETS.cover && asset.lifecycle !== "unavailable");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);
  const request = React.useRef<AbortController | null>(null);
  // Starting one's own work always takes precedence over a pending example.
  React.useEffect(() => { request.current?.abort(); }, [media, values[WEAVE_TARGETS.pick], values[WEAVE_TARGETS.language], lyrics]);
  React.useEffect(() => () => request.current?.abort(), []);
  const go = (target: string, file = false) => {
    request.current?.abort();
    setBusy(false);
    setError(false);
    navigate(target, file);
  };
  const loadExample = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(false);
    try {
      const [response, convert] = await Promise.all([
        runSongSearch("旅行的意义 陈绮贞", "cn", controller.signal),
        getScriptConverter("cn"),
      ]);
      const result = response.listing?.results.find(song => convert(song.title).includes("旅行的意义") && convert(song.artist).includes("陈绮贞"));
      if (!result || !response.listing) throw new Error("Example unavailable");
      if (controller.signal.aborted) return;
      await pickSong({
        dispatch: command => dispatch(command.type === "controls.apply"
          ? { ...command, values: { ...command.values, [WEAVE_TARGETS.language]: "cn" } }
          : command),
        language: "cn", result, signal: controller.signal, store: response.listing.store, uploadIds: [],
      });
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (request.current === controller) setBusy(false);
    }
  };
  if (cover && lyrics) return null;
  if (!cover && uploading) return null;
  return (
    <Empty className="pointer-events-auto max-w-sm text-[color:var(--foreground)]" data-empty-canvas-guide="" translate="no" aria-label={zh ? "开始制作封面" : "Create a cover"}>
      <EmptyHeader>
        <EmptyTitle>{cover ? (zh ? "添加歌词" : "Add lyrics") : lyrics ? (zh ? "添加封面" : "Add a cover") : (zh ? "开始制作" : "Create a cover")}</EmptyTitle>
        <EmptyDescription>{cover ? (zh ? "粘贴歌词，生成文字封面。" : "Paste lyrics to create your cover.") : (zh ? "搜索歌曲，或上传自己的封面。" : "Find a song or upload your own cover.")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          {cover ? <Button variant="secondary" size="sm" onClick={() => go(WEAVE_TARGETS.lyrics)}>{zh ? "粘贴歌词" : "Add lyrics"}</Button> : <>
            <Button variant="secondary" size="sm" onClick={() => go(WEAVE_TARGETS.pick)}><MagnifyingGlassIcon weight="light" data-icon="inline-start" />{zh ? "搜索一首歌" : "Find a song"}</Button>
            <Button variant="secondary" size="sm" onClick={() => go(WEAVE_TARGETS.cover, true)}><CloudArrowUpIcon weight="light" data-icon="inline-start" />{zh ? "上传封面" : "Upload a cover"}</Button>
          </>}
        </div>
        {!cover && !lyrics ? <Button variant="ghost-muted" size="sm" loading={busy} onClick={() => void loadExample()}>{zh ? "试试示例 · 旅行的意义" : "Try an example · The Meaning of Travel"}</Button> : null}
        {error ? <div role="status"><EmptyDescription>{zh ? "示例暂时无法加载，请重试或搜索一首歌。" : "The example is unavailable. Try again or search for a song."}</EmptyDescription></div> : null}
      </EmptyContent>
    </Empty>
  );
}
