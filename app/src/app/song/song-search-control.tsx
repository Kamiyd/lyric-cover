import * as React from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { ToolcraftCustomControlRendererProps } from "@/toolcraft/runtime/react";
import { InputGroup, InputGroupAddon, InputGroupInput, Spinner, useToolcraftUiLanguage } from "@/toolcraft/ui";

import { translateUiText, translateSongStatus } from "../i18n/messages";
import { playWeaveCue } from "../sound/weave-sound-player";
import { getUploadedCovers } from "../weave/cover-source";
import { WEAVE_TARGETS } from "../weave/weave-params";
import { getScriptConverter, type ScriptConverter } from "./chinese-script";
import { cleanSongTitle } from "./lyrics-text";
import { pickSong, runSongSearch, type SearchStatus, type SongListing } from "./song-actions";
import { SongResultList, toResultRows } from "./song-result-list";
import { isSongLanguage, readPickedSong, type PickedSong, type SongLanguage } from "./song-types";
import styles from "./song-search-control.module.css";

const SEARCH_DEBOUNCE_MS = 450;
const identity: ScriptConverter = (text) => text;

function describeIdle(picked: PickedSong | null, hasUpload: boolean, convert: ScriptConverter): string {
  if (picked && hasUpload) return "Using the uploaded cover";
  if (picked) return `${convert(cleanSongTitle(picked.title))} · ${convert(picked.artist)}`;
  return "Type a song or artist";
}

export function SongSearchControl({
  controlId,
  dispatch,
  state,
  value,
}: ToolcraftCustomControlRendererProps): React.JSX.Element {
  const picked = readPickedSong(value);
  const { language: uiLanguage } = useToolcraftUiLanguage();
  const languageValue = state.values[WEAVE_TARGETS.language];
  const language: SongLanguage = isSongLanguage(languageValue) ? languageValue : "cn";
  const uploadIds = React.useMemo(
    () => getUploadedCovers(state.mediaAssets).map((asset) => asset.id),
    [state.mediaAssets],
  );

  const [term, setTerm] = React.useState("");
  const [listing, setListing] = React.useState<SongListing | null>(null);
  const [active, setActive] = React.useState(0);
  const [status, setStatus] = React.useState<SearchStatus>({ kind: "idle" });
  const [convert, setConvert] = React.useState<ScriptConverter>(() => identity);
  const searchRef = React.useRef<AbortController | null>(null);
  const pickRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    let current = true;
    void getScriptConverter(language).then((converter) => {
      if (current) setConvert(() => converter);
    });
    return () => {
      current = false;
    };
  }, [language]);

  React.useEffect(
    () => () => {
      searchRef.current?.abort();
      pickRef.current?.abort();
    },
    [],
  );

  const search = React.useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length === 0) return;
      searchRef.current?.abort();
      const controller = new AbortController();
      searchRef.current = controller;
      setStatus({ kind: "busy", message: "Searching…" });
      runSongSearch(trimmed, language, controller.signal).then(
        (response) => {
          if (controller.signal.aborted) return;
          setListing(response.listing);
          setActive(0);
          setStatus(response.status);
          if (response.status.kind === "error") playWeaveCue({ name: "error" });
        },
        () => undefined,
      );
    },
    [language],
  );

  React.useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    if (listing && listing.term === trimmed && listing.language === language) return;
    const timer = setTimeout(() => search(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [language, listing, search, term]);

  const pickIndex = React.useCallback(
    (index: number) => {
      const result = listing?.results[index];
      if (!listing || !result) return;
      setActive(index);
      pickRef.current?.abort();
      const controller = new AbortController();
      pickRef.current = controller;
      setStatus({ kind: "busy", message: "Fetching lyrics…" });
      pickSong({ dispatch, language, result, signal: controller.signal, store: listing.store, uploadIds }).then(
        (next) => {
          if (next) setStatus(next);
          // The song was applied but its lyrics could not be fetched: done, but needs a look.
          if (next?.kind === "error") playWeaveCue({ name: "warning" });
        },
        () => undefined,
      );
    },
    [dispatch, language, listing, uploadIds],
  );

  const rows = React.useMemo(
    () => toResultRows(listing?.results ?? [], convert, controlId, picked),
    [controlId, convert, listing, picked],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const count = rows.length;
    if (event.key === "ArrowDown" && count > 0) {
      event.preventDefault();
      setActive((index) => Math.min(count - 1, index + 1));
      playWeaveCue({ name: "select", options: { direction: "forward" } });
    } else if (event.key === "ArrowUp" && count > 0) {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
      playWeaveCue({ name: "select", options: { direction: "back" } });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const trimmed = term.trim();
      const current = listing && listing.term === trimmed && listing.language === language;
      if (current && count > 0) pickIndex(active);
      else search(trimmed);
    } else if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  };

  const statusText =
    status.kind === "idle" ? describeIdle(picked, uploadIds.length > 0, convert) : status.message;

  return (
    <div className={styles.root} data-song-search="" translate="no">
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <MagnifyingGlassIcon />
        </InputGroupAddon>
        <InputGroupInput
          aria-controls={`${controlId}-results`}
          aria-label={translateUiText("Search a song", uiLanguage)}
          data-cuelume-type=""
          id={controlId}
          onChange={(event) => setTerm(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder={translateUiText("Song or artist", uiLanguage)}
          value={term}
        />
        {status.kind === "busy" ? (
          <InputGroupAddon align="inline-end">
            <Spinner />
          </InputGroupAddon>
        ) : null}
      </InputGroup>
      <p aria-live="polite" className={styles.status} data-song-search-status="" data-state={status.kind}>
        {status.kind === "idle" && picked && uploadIds.length === 0 ? statusText : translateSongStatus(statusText, uiLanguage)}
      </p>
      <SongResultList
        active={active}
        label={translateUiText("Search results", uiLanguage)}
        id={`${controlId}-results`}
        onHover={setActive}
        onPick={pickIndex}
        rows={rows}
      />
    </div>
  );
}
