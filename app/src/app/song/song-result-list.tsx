import * as React from "react";
import { Button, ScrollFade } from "@/toolcraft/ui";

import type { ScriptConverter } from "./chinese-script";
import type { PickedSong, SongSearchResult } from "./song-types";
import styles from "./song-search-control.module.css";

export type ResultRow = Readonly<{
  album: string;
  artist: string;
  duration: string;
  id: string;
  index: number;
  key: string;
  selected: boolean;
  thumbnailUrl: string;
  title: string;
}>;

function formatDuration(durationMs: number): string {
  if (durationMs <= 0) return "";
  const seconds = Math.round(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function toResultRows(
  results: readonly SongSearchResult[],
  convert: ScriptConverter,
  idPrefix: string,
  picked: PickedSong | null,
): readonly ResultRow[] {
  const selectedKey = picked ? `${picked.trackId}-${picked.artworkUrl}` : "";
  return results.map((result, index) => {
    const key = `${result.trackId}-${result.artworkUrl}`;
    return {
      album: convert(result.album),
      artist: convert(result.artist),
      duration: formatDuration(result.durationMs),
      id: `${idPrefix}-result-${index}`,
      index,
      key,
      selected: key === selectedKey,
      thumbnailUrl: result.thumbnailUrl,
      title: convert(result.title),
    };
  });
}

function SongResultRow({
  active,
  onHover,
  onPick,
  row,
}: Readonly<{
  active: boolean;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
  row: ResultRow;
}>): React.JSX.Element {
  return (
    <Button
      aria-pressed={row.selected}
      className={styles.row}
      data-active={active ? "true" : "false"}
      data-result-index={row.index}
      id={row.id}
      onClick={() => onPick(row.index)}
      onMouseMove={() => onHover(row.index)}
      type="button"
      variant="ghost"
    >
      <img alt="" className={styles.thumb} loading="lazy" src={row.thumbnailUrl} />
      <span className={styles.text}>
        <span className={styles.title}>{row.title}</span>
        <span className={styles.meta}>
          {row.artist}
          {row.album ? ` · ${row.album}` : ""}
        </span>
      </span>
      <span className={styles.duration}>{row.duration}</span>
    </Button>
  );
}

export function SongResultList({
  active,
  id,
  label,
  onHover,
  onPick,
  rows,
}: Readonly<{
  active: number;
  id: string;
  label: string;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
  rows: readonly ResultRow[];
}>): React.JSX.Element | null {
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-result-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (rows.length === 0) return null;
  return (
    <ScrollFade className={styles.viewport} scrollBoundaryBehavior="chain">
      <div aria-label={label} className={styles.list} id={id} ref={listRef}>
        {rows.map((row) => (
          <SongResultRow
            active={row.index === active}
            key={row.key}
            onHover={onHover}
            onPick={onPick}
            row={row}
          />
        ))}
      </div>
    </ScrollFade>
  );
}
