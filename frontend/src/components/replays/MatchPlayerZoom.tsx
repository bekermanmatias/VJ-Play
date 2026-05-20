import { useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import ClipsPanel from "@/components/replays/ClipsPanel";
import type { ReplayClipItem } from "@/components/replays/clip-types";
import MatchPlayer, { type MatchPlayerHandle } from "@/components/replays/MatchPlayer";

type Props = {
  videoSrc: string;
  poster?: string;
  clockLabel: string;
  apiBase?: string;
  matchKey?: string;
  sessionToken?: string | null;
  fullMatchSizeBytes?: number | null;
  chromeVariant?: "default" | "ghost";
  /** fill: ocupa el 100% del padre (overlay). scroll: mínimo alto pantalla + scroll si hay clips (cine / partido). */
  layout?: "fill" | "scroll";
};

export default function MatchPlayerZoom({
  videoSrc,
  poster,
  clockLabel,
  apiBase = "",
  matchKey = "",
  sessionToken = null,
  fullMatchSizeBytes = null,
  chromeVariant = "default",
  layout = "scroll",
}: Props) {
  const playerRef = useRef<MatchPlayerHandle>(null);
  const [clipsOpen, setClipsOpen] = useState(false);
  const [clips, setClips] = useState<ReplayClipItem[]>([]);
  const [hudHost, setHudHost] = useState<HTMLDivElement | null>(null);

  const fill = layout === "fill";
  const rootClass = fill
    ? "flex h-full min-h-0 w-full flex-col overflow-hidden"
    : "flex min-h-[100dvh] w-full flex-col";
  const shellClass = "flex min-h-0 flex-1 basis-0 flex-col overflow-hidden lg:flex-row";

  return (
    <div className={rootClass}>
      <div className={shellClass}>
        <div className="relative min-h-0 flex-1 basis-0">
        <div
          className={fill ? "!flex !h-full !min-h-0 !flex-1 !basis-0" : "!flex-1 !min-h-0"}
          style={
            fill
              ? { width: "100%", height: "100%", minHeight: 0, flex: "1 1 0%", display: "flex", flexDirection: "column" }
              : undefined
          }
        >
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={5}
            centerOnInit
            wheel={{
              // Zoom con rueda: paso por tick (la librería no expone smoothStep en los tipos actuales).
              step: 0.0007,
              wheelDisabled: false,
              touchPadDisabled: false,
            }}
            pinch={{ step: 0.25, disabled: false, allowPanning: true }}
            panning={{ velocityDisabled: false, allowLeftClickPan: true }}
            doubleClick={{ mode: "reset", disabled: false }}
          >
            <TransformComponent
              wrapperClass="!h-full !min-h-0 !w-full touch-none"
              contentClass="!flex !h-full !min-h-0 !w-full items-center justify-center"
            >
              <MatchPlayer
                ref={playerRef}
                videoSrc={videoSrc}
                poster={poster}
                clockLabel={clockLabel}
                rootClassName="relative h-full min-h-0 w-full overflow-hidden bg-black !aspect-auto"
                videoClassName="h-full w-full max-h-[100dvh] object-contain"
                showClipsPanel={false}
                clipsOpen={clipsOpen}
                onClipsOpenChange={setClipsOpen}
                chromeVariant={chromeVariant}
                hudPortalTarget={hudHost}
                clipApiBase={apiBase}
                matchKey={matchKey}
                sessionToken={sessionToken}
                onClipsUpdate={setClips}
              />
            </TransformComponent>
          </TransformWrapper>
        </div>
          {/* Capa del HUD: fija a los bordes del area visible, fuera del zoom/pan. */}
          <div
            ref={setHudHost}
            aria-hidden={false}
            className="pointer-events-none absolute inset-0 z-10"
          />
        </div>

        <aside
          className={[
            "shrink-0 overflow-hidden border-white/10 transition-all duration-300 ease-out",
            "lg:h-full lg:max-h-full lg:border-l lg:border-t-0",
            clipsOpen
              ? "max-h-[62dvh] border-t px-3 pb-3 pt-3 opacity-100 lg:max-h-full lg:w-[360px] lg:px-4 lg:pb-4 lg:pt-4"
              : "max-h-0 border-t border-transparent px-3 pb-0 pt-0 opacity-0 lg:max-h-full lg:w-0 lg:border-l lg:border-l-transparent lg:px-0 lg:pb-0 lg:pt-0",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden={!clipsOpen}
        >
          <div className="h-full min-h-0 overflow-hidden">
            <ClipsPanel
              clips={clips}
              videoSrc={videoSrc}
              matchKey={matchKey}
              fullMatchSizeBytes={fullMatchSizeBytes}
              onSelectClip={(at) => playerRef.current?.seekTo(at)}
              onRenameClip={(clipId, nextLabel) => {
                void playerRef.current?.renameClip(clipId, nextLabel);
              }}
              onDeleteClip={(clipId) => {
                void playerRef.current?.deleteClip(clipId);
              }}
              onAuthorizedDownload={
                apiBase.trim() && typeof sessionToken === "string" && sessionToken.trim()
                  ? (clip) => void playerRef.current?.downloadClip(clip)
                  : undefined
              }
              onAuthorizedFullMatchDownload={
                apiBase.trim() && typeof sessionToken === "string" && sessionToken.trim()
                  ? (fileName) => void playerRef.current?.downloadFullMatch(fileName)
                  : undefined
              }
              surface="dark"
              layout="side"
              sectionClassName="h-full min-h-0"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
