import * as React from "react";
import { Search, Upload, ArrowRight } from "lucide-react";
import { useToolcraftControlNavigation, useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";
import { Button, Spinner, useToolcraftUiLanguage } from "@/toolcraft/ui";
import { resolveCoverSource } from "../weave/cover-source";
import { WEAVE_TARGETS } from "../weave/weave-params";
import { pickSong, runSongSearch } from "../song/song-actions";
import { getScriptConverter } from "../song/chinese-script";
import styles from "./empty-canvas-guide.module.css";

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
    <section className={styles.guide} data-empty-canvas-guide="" translate="no" aria-label={zh ? "开始制作封面" : "Create a cover"}>
      <h1>{cover ? (zh ? "再添几句歌词" : "Just add the lyrics") : lyrics ? (zh ? "还差一张封面" : "Now add a cover") : (zh ? "把喜欢的歌，织成一张封面。" : "Weave a song into its cover.")}</h1>
      <p>{cover ? (zh ? "粘贴歌词，让文字组成画面。" : "Paste the lyrics and let the words form the image.") : (zh ? "搜索一首歌，或用自己的封面和歌词。" : "Find a song, or bring your own cover and lyrics.")}</p>
      <div className={styles.actions}>
        {cover ? <Button variant="secondary" size="sm" onClick={() => go(WEAVE_TARGETS.lyrics)}>{zh ? "粘贴歌词" : "Add lyrics"}<ArrowRight data-icon="lyrics" /></Button> : <>
          <Button variant="secondary" size="sm" onClick={() => go(WEAVE_TARGETS.pick)}><Search data-icon="search" />{zh ? "搜索一首歌" : "Find a song"}</Button>
          <Button variant="ghost" size="sm" onClick={() => go(WEAVE_TARGETS.cover, true)}><Upload data-icon="upload" />{zh ? "上传封面" : "Upload a cover"}</Button>
        </>}
      </div>
      {!cover && !lyrics ? <Button className={styles.example} variant="ghost" size="sm" disabled={busy} onClick={() => void loadExample()}>{busy ? <Spinner /> : null}{busy ? (zh ? "正在加载示例…" : "Loading example…") : (zh ? "试试示例 · 旅行的意义" : "Try an example · The Meaning of Travel")}{!busy ? <ArrowRight data-icon="example" /> : null}</Button> : null}
      {error ? <p className={styles.error} role="status">{zh ? "示例暂时无法加载，请重试或搜索一首歌。" : "The example is unavailable. Try again or search for a song."}</p> : null}
    </section>
  );
}
