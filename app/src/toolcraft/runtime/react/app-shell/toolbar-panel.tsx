"use client";

import { getFreeAreaCenterOffsetX } from "./free-area-center";

import * as React from "react";
import { TargetIcon } from "@phosphor-icons/react";
import {
  Button,
  PanelSurface,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useToolcraftUiLanguage,
  useToolcraftUiSound,
} from "@/toolcraft/ui";
import { Moon, Redo2, Sun, Undo2, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";

import {
  clampToolcraftCanvasZoom,
  toolcraftCanvasZoomDefault,
  toolcraftCanvasZoomStep,
  zoomToolcraftCanvasOffset,
} from "../../state/canvas-zoom";
import type { ToolcraftPanelState, ToolcraftState } from "../../state/types";
import { PanelContainer } from "../panel-host/panel-host";
import { useToolcraftPanelBinding } from "../panel-host/use-toolcraft-panel-binding";
import type { PanelPlacement, PanelStateChange } from "../panel-host/panel-host-types";
import { useToolcraftTheme } from "./theme-runtime";
import { useToolcraftCommittedSelector } from "./toolcraft-selectors";
import { useToolcraftDispatch } from "./use-toolcraft";
import { useToolcraftHistory, requestToolcraftHistory } from './history-scope';

export type ToolbarPanelProps = {
  className?: string;
  framed?: boolean;
  onPanelStateChange?: PanelStateChange;
  panelPlacement?: PanelPlacement;
  panelState?: ToolcraftPanelState;
};

type ToolbarIconButtonProps = {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  languageSwitch?: boolean;
  onClick?: () => void;
};

const toolbarIconButtonSize = "icon";
const desktopToolbarTightButtonGapClassName = "-mr-px";
const selectToolbar = (state: ToolcraftState) => state.schema.toolbar;
const selectCommittedZoom = (state: ToolcraftState) => state.canvas.zoom;
const selectCommittedOffset = (state: ToolcraftState) => state.canvas.offset;
const selectControlsPanelState = (state: ToolcraftState) => state.panels.controls;
/** The controls panel settles into a snapped position with a 0.3 s animation. */
const controlsPanelSettleMs = 380;


function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

function ToolbarDivider(): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="block h-5 w-px shrink-0 rounded-full bg-[color:color-mix(in_oklab,var(--border)_8%,transparent)]"
      data-slot="desktop-toolbar-divider"
    />
  );
}

function ToolbarIconButton({
  active = false,
  children,
  className,
  disabled,
  label,
  languageSwitch,
  onClick,
}: ToolbarIconButtonProps): React.JSX.Element {
  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.();

    if (typeof event.currentTarget.blur === "function") {
      event.currentTarget.blur();
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            data-cuelume-tap=""
            data-ui-language-switch={languageSwitch ? "" : undefined}
            aria-pressed={active}
            className={cn(
              "data-[icon-active=true]:text-[color:var(--foreground)]",
              className,
            )}
            data-icon-active={active}
            disabled={disabled}
            onClick={handleClick}
            size={toolbarIconButtonSize}
            type="button"
            variant="ghost"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ToolbarPanel({
  className,
  framed = true,
  onPanelStateChange,
  panelPlacement,
  panelState,
}: ToolbarPanelProps): React.JSX.Element | null {
  const dispatch = useToolcraftDispatch();
  const { language, setLanguage } = useToolcraftUiLanguage();
  const { enabled: soundEnabled, setEnabled: setSoundEnabled } = useToolcraftUiSound();
  const panelBinding = useToolcraftPanelBinding({
    onPanelStateChange,
    panelId: "toolbar",
    panelState,
  });
  const resolvedPanelState = panelBinding.panelState;
  const { resolvedTheme, toggleResolvedTheme } = useToolcraftTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
  const { port: history, state: historyState } = useToolcraftHistory();
  const canUndo = historyState.available && historyState.canUndo;
  const canRedo = historyState.available && historyState.canRedo;
  const toolbar = useToolcraftCommittedSelector(selectToolbar);
  const zoom = useToolcraftCommittedSelector(selectCommittedZoom);
  const offset = useToolcraftCommittedSelector(selectCommittedOffset);
  const centerCanvas = React.useCallback((): void => {
    dispatch({ type: "canvas.center" });
    const x = getFreeAreaCenterOffsetX();
    if (x !== 0) dispatch({ offset: { x, y: 0 }, type: "canvas.setOffset" });
  }, [dispatch]);
  // Toolbar zoom scales around the centre of the free area, so a centred canvas stays centred.
  const zoomTo = React.useCallback(
    (nextZoom: number): void => {
      const clamped = clampToolcraftCanvasZoom(nextZoom);
      dispatch({
        offset: zoomToolcraftCanvasOffset(offset, zoom, clamped, { x: getFreeAreaCenterOffsetX(), y: 0 }),
        type: "canvas.setViewport",
        zoom: clamped,
      });
    },
    [dispatch, offset, zoom],
  );
  // The toolbar sits under the canvas area, so it follows the same free-area centre and
  // re-measures when the controls panel moves, collapses or the window resizes.
  const controlsPanelState = useToolcraftCommittedSelector(selectControlsPanelState);
  const [freeAreaCenterX, setFreeAreaCenterX] = React.useState(0);
  const measuredCenterX = React.useRef(0);
  const latestOffset = React.useRef(offset);
  latestOffset.current = offset;
  React.useEffect(() => {
    const measure = (): void => {
      const next = getFreeAreaCenterOffsetX();
      const previous = measuredCenterX.current;
      if (next === previous) return;
      measuredCenterX.current = next;
      setFreeAreaCenterX(next);
      // A canvas that was horizontally centred (including the default position) stays centred
      // when the free area changes; one the user has panned elsewhere is left alone.
      if (latestOffset.current.x === previous) {
        dispatch({ offset: { x: next, y: latestOffset.current.y }, type: "canvas.setOffset" });
      }
    };
    const frame = requestAnimationFrame(measure);
    const settled = window.setTimeout(measure, controlsPanelSettleMs);
    const observer = new ResizeObserver(measure);
    for (const selector of ['[data-slot="toolcraft-runtime-canvas"]', "[data-toolcraft-controls-panel-shell]"]) {
      const element = document.querySelector(selector);
      if (element) observer.observe(element);
    }
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settled);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [controlsPanelState, dispatch]);
  const historyEnabled = toolbar.history;
  const radarEnabled = toolbar.radar;
  const themeEnabled = toolbar.theme;
  const zoomEnabled = toolbar.zoom;

  if (resolvedPanelState.hidden) {
    return null;
  }

  const toolbarSurface = (
    <PanelSurface
      className={cn(
        "pointer-events-auto flex w-auto items-center justify-start gap-1.5 rounded-lg p-1",
        !framed && className,
      )}
      data-toolcraft-inspect-toolbar="true"
      data-panel-id="toolbar"
    >
      {historyEnabled ? (
        <>
          <ToolbarIconButton
            className={desktopToolbarTightButtonGapClassName}
            disabled={!canUndo}
            label="Undo"
            onClick={() => requestToolcraftHistory(history, 'undo')}
          >
            <Undo2 />
          </ToolbarIconButton>
          <ToolbarIconButton
            className={desktopToolbarTightButtonGapClassName}
            disabled={!canRedo}
            label="Redo"
            onClick={() => requestToolcraftHistory(history, 'redo')}
          >
            <Redo2 />
          </ToolbarIconButton>
          <ToolbarDivider />
        </>
      ) : null}
      {zoomEnabled ? (
        <>
          <ToolbarIconButton
            label="Zoom out"
            onClick={() => zoomTo(zoom - toolcraftCanvasZoomStep)}
          >
            <ZoomOut />
          </ToolbarIconButton>
          <span
            className="inline-flex h-7 w-[4ch] shrink-0 cursor-default items-center justify-center font-mono text-[12px] leading-[1.125rem] text-[color:color-mix(in_oklab,var(--foreground)_90%,transparent)] tabular-nums select-none"
            data-panel-drag-ignore=""
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              zoomTo(toolcraftCanvasZoomDefault);
            }}
          >
            {zoom}%
          </span>
          <ToolbarIconButton
            label="Zoom in"
            onClick={() => zoomTo(zoom + toolcraftCanvasZoomStep)}
          >
            <ZoomIn />
          </ToolbarIconButton>
          <ToolbarDivider />
        </>
      ) : null}
      {themeEnabled ? (
        <ToolbarIconButton
          label={nextTheme === "light" ? "Light theme" : "Dark theme"}
          onClick={toggleResolvedTheme}
        >
          {nextTheme === "light" ? (
            <Sun data-icon="theme-light" />
          ) : (
            <Moon data-icon="theme-dark" />
          )}
        </ToolbarIconButton>
      ) : null}
      {toolbar.language ? (
        <ToolbarIconButton
          languageSwitch
          label={language === "en" ? "切换到中文" : "Switch to English"}
          onClick={() => setLanguage(language === "en" ? "zh-CN" : "en")}
        >
          <span data-icon="language" className="text-[11px] font-medium leading-none" translate="no">{language === "zh-CN" ? "EN" : "中"}</span>
        </ToolbarIconButton>
      ) : null}
      {toolbar.sound ? (
        <ToolbarIconButton
          label={soundEnabled ? "Mute sounds" : "Turn sounds on"}
          onClick={() => setSoundEnabled(!soundEnabled)}
        >
          {soundEnabled ? <Volume2 data-icon="sound-on" /> : <VolumeX data-icon="sound-off" />}
        </ToolbarIconButton>
      ) : null}
      {radarEnabled ? (
        <ToolbarIconButton
          label="Center canvas"
          onClick={centerCanvas}
        >
          <TargetIcon />
        </ToolbarIconButton>
      ) : null}
    </PanelSurface>
  );

  return (
    <PanelContainer
      onPanelStateChange={panelBinding.onPanelStateChange}
      panelState={resolvedPanelState}
      panelStyle={{
        left: `calc(50% + ${freeAreaCenterX}px)`,
        transition: "left 200ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      panelType="toolbar"
      placement={panelPlacement ?? (framed ? "frame" : "surface")}
    >
      {toolbarSurface}
    </PanelContainer>
  );
}
