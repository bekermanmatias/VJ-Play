import { useRef, useState } from "react";
import ClipsPanel from "@/components/replays/ClipsPanel";
import MatchPlayer, { type MatchPlayerHandle } from "@/components/replays/MatchPlayer";
import { DEMO_CLIPS } from "@/components/replays/demo-clips";

type Props = {
  videoSrc: string;
  poster?: string;
  clockLabel: string;
};

/** Reproductor dentro del recuadro negro y clips como sección normal debajo (fuera del recuadro). */
export default function ReplayMatchBlock({ videoSrc, poster, clockLabel }: Props) {
  const playerRef = useRef<MatchPlayerHandle>(null);
  const [clipsOpen, setClipsOpen] = useState(false);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-black shadow-xl">
        <MatchPlayer
          ref={playerRef}
          videoSrc={videoSrc}
          poster={poster}
          clockLabel={clockLabel}
          showClipsPanel={false}
          clipsOpen={clipsOpen}
          onClipsOpenChange={setClipsOpen}
        />
      </div>
      {clipsOpen && (
        <ClipsPanel
          clips={DEMO_CLIPS}
          videoSrc={videoSrc}
          onSelectClip={(at) => playerRef.current?.seekTo(at)}
          surface="page"
          sectionClassName="mt-8"
        />
      )}
    </>
  );
}
