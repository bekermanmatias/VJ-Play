import { useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import ClipsPanel from "@/components/replays/ClipsPanel";
import MatchPlayer, { type MatchPlayerHandle } from "@/components/replays/MatchPlayer";
import { DEMO_CLIPS } from "@/components/replays/demo-clips";

type Props = {
  videoSrc: string;
  poster?: string;
  clockLabel: string;
  chromeVariant?: "default" | "ghost";
  /** fill: ocupa el 100% del padre (overlay). scroll: mínimo alto pantalla + scroll si hay clips (cine / partido). */
  layout?: "fill" | "scroll";
};

export default function MatchPlayerZoom({
  videoSrc,
  poster,
  clockLabel,
  chromeVariant = "default",
  layout = "scroll",
}: Props) {
  const playerRef = useRef<MatchPlayerHandle>(null);
  const [clipsOpen, setClipsOpen] = useState(false);

  const fill = layout === "fill";
  const rootClass = fill
    ? "flex h-full min-h-0 w-full flex-col"
    : "flex min-h-[100dvh] w-full flex-col";

  return (
    <div className={rootClass}>
      <TransformWrapper
        initialScale={1}
        minScale={1}
        maxScale={5}
        centerOnInit
        wheel={{
          step: 0.12,
          wheelDisabled: false,
          touchPadDisabled: false,
        }}
        pinch={{ step: 5, disabled: false, allowPanning: true }}
        panning={{ velocityDisabled: false, allowLeftClickPan: true }}
        doubleClick={{ mode: "reset", disabled: false }}
        className={fill ? "!flex !h-full !min-h-0 !flex-1 !basis-0" : "!flex-1 !min-h-0"}
        style={
          fill
            ? { width: "100%", height: "100%", minHeight: 0, flex: "1 1 0%", display: "flex", flexDirection: "column" }
            : undefined
        }
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
          />
        </TransformComponent>
      </TransformWrapper>

      {clipsOpen && (
        <ClipsPanel
          clips={DEMO_CLIPS}
          videoSrc={videoSrc}
          onSelectClip={(at) => playerRef.current?.seekTo(at)}
          surface="dark"
          sectionClassName="shrink-0 px-3 sm:px-4"
        />
      )}
    </div>
  );
}
