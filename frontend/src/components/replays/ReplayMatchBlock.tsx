import { useRef, useState } from "react";
import ClipsPanel from "@/components/replays/ClipsPanel";
import type { ReplayClipItem } from "@/components/replays/clip-types";
import MatchPlayer, { type MatchPlayerHandle } from "@/components/replays/MatchPlayer";

type Props = {
  apiBase?: string;
  matchKey?: string;
  sessionToken?: string | null;
  videoSrc: string;
  poster?: string;
  clockLabel: string;
};

/** Reproductor dentro del recuadro negro y clips como sección normal debajo (fuera del recuadro). */
export default function ReplayMatchBlock({
  apiBase = "",
  matchKey = "",
  sessionToken = null,
  videoSrc,
  poster,
  clockLabel,
}: Props) {
  const playerRef = useRef<MatchPlayerHandle>(null);
  const [clipsOpen, setClipsOpen] = useState(false);
  const [clips, setClips] = useState<ReplayClipItem[]>([]);

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
          clipApiBase={apiBase}
          matchKey={matchKey}
          sessionToken={sessionToken}
          onClipsUpdate={setClips}
        />
      </div>
      {clipsOpen && (
        <ClipsPanel
          clips={clips}
          videoSrc={videoSrc}
          onSelectClip={(at) => playerRef.current?.seekTo(at)}
          onRenameClip={(clipId, nextLabel) => {
            setClips((prev) =>
              prev.map((clip) => (clip.id === clipId ? { ...clip, label: nextLabel } : clip)),
            );
          }}
          onDeleteClip={(clipId) => {
            setClips((prev) => prev.filter((clip) => clip.id !== clipId));
          }}
          surface="page"
          sectionClassName="mt-8"
        />
      )}
    </>
  );
}
