import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Clapperboard,
  Download,
  FastForward,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  Rewind,
  Settings,
  Share2,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { createPortal } from "react-dom";
import ClipsPanel from "@/components/replays/ClipsPanel";
import { DEMO_CLIPS } from "@/components/replays/demo-clips";

export type MatchPlayerHandle = {
  seekTo: (seconds: number) => void;
};

type Props = {
  videoSrc: string;
  poster?: string;
  /** Texto tipo reloj arriba a la izquierda (ej. hora del turno) */
  clockLabel: string;
  /** Clases del contenedor raíz (ej. pantalla completa sin aspect-video) */
  rootClassName?: string;
  /** Clases del elemento video (object-cover vs object-contain) */
  videoClassName?: string;
  /** Si es false, no se renderiza el panel de clips debajo (ej. modo zoom: lo pinta el padre) */
  showClipsPanel?: boolean;
  /** Modo controlado: estado abierto del panel de clips */
  clipsOpen?: boolean;
  /** Modo controlado: callback al abrir/cerrar clips */
  onClipsOpenChange?: (open: boolean) => void;
  /** UI tipo overlay: iconos sin cajas oscuras */
  chromeVariant?: "default" | "ghost";
  /** Si se provee, el HUD se monta en este elemento via portal (queda fuera del zoom). */
  hudPortalTarget?: HTMLElement | null;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const BRIGHTNESS_MIN = 70;
const BRIGHTNESS_MAX = 130;
const CONTRAST_MIN = 70;
const CONTRAST_MAX = 130;
const FILTER_STEP = 5;
const SUPPORT_EMAIL = "info@varelajunior.com.ar";

const MatchPlayer = forwardRef<MatchPlayerHandle, Props>(function MatchPlayer(
  {
    videoSrc,
    poster,
    clockLabel,
    rootClassName,
    videoClassName = "h-full w-full object-cover",
    showClipsPanel = true,
    clipsOpen: clipsOpenProp,
    onClipsOpenChange,
    chromeVariant = "default",
    hudPortalTarget,
  },
  ref,
) {
  const ghost = chromeVariant === "ghost";

  const sideIconBtn = ghost
    ? "grid h-11 w-11 place-items-center rounded-full text-white transition hover:bg-white/15 [filter:drop-shadow(0_2px_8px_rgba(0,0,0,0.85))]"
    : "grid h-11 w-11 place-items-center rounded-lg bg-black/55 text-white/95 ring-1 ring-white/45 hover:bg-black/70";

  const seekDefaultBtn =
    "grid h-10 w-10 place-items-center rounded-lg bg-black/55 text-white/95 ring-1 ring-white/45 hover:bg-black/70";

  const shellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const settingsAnchorRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isClipRecording, setIsClipRecording] = useState(false);
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uncontrolledClipsOpen, setUncontrolledClipsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [brightnessPct, setBrightnessPct] = useState(100);
  const [contrastPct, setContrastPct] = useState(100);

  const isClipsControlled =
    clipsOpenProp !== undefined && onClipsOpenChange !== undefined;
  const clipsOpen = isClipsControlled ? clipsOpenProp! : uncontrolledClipsOpen;
  const setClipsOpen = isClipsControlled
    ? onClipsOpenChange!
    : setUncontrolledClipsOpen;
  const syncTime = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrent(v.currentTime);
    setDuration(v.duration || 0);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVolume = () => setMuted(v.muted);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("volumechange", onVolume);
    v.addEventListener("timeupdate", syncTime);
    v.addEventListener("loadedmetadata", syncTime);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("volumechange", onVolume);
      v.removeEventListener("timeupdate", syncTime);
      v.removeEventListener("loadedmetadata", syncTime);
    };
  }, [syncTime]);

  useEffect(() => {
    const syncFs = () => {
      const shell = shellRef.current;
      if (!shell) return;
      setIsFullscreen(document.fullscreenElement === shell);
    };

    syncFs();
    document.addEventListener("fullscreenchange", syncFs);
    return () => document.removeEventListener("fullscreenchange", syncFs);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (settingsAnchorRef.current?.contains(t)) return;
      setSettingsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  const seekTo = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seconds;
    setCurrent(seconds);
    void v.play().catch(() => {});
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      seekTo,
    }),
    [seekTo],
  );

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) await v.play();
    else v.pause();
  };

  const seek = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, v.currentTime + delta), v.duration || Infinity);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const cycleSpeed = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : 1;
    v.playbackRate = next;
    setSpeed(next);
  };

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await shell.requestFullscreen();
    } catch {
      // noop
    }
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      // noop
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Varela Junior — Replay", url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      // noop
    }
  };

  const reportProblem = () => {
    const subject = encodeURIComponent("Problema con replay");
    const body = encodeURIComponent(
      `Describí el problema:\n\n---\nURL: ${window.location.href}`,
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const toggleClipRecording = () => {
    const v = videoRef.current;
    if (!v) return;
    if (!isClipRecording) {
      setIsClipRecording(true);
      setClipStart(v.currentTime);
      return;
    }
    setIsClipRecording(false);
    setClipStart(null);
  };

  const hud = (
    <>
        <div
          className={
            ghost
              ? "pointer-events-none absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-black/30"
              : "pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-black/35"
          }
        />

        <div
          className={
            ghost
              ? "pointer-events-none absolute left-4 top-4 text-xs font-semibold tabular-nums text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]"
              : "pointer-events-none absolute left-4 top-4 text-xs font-semibold tracking-wide text-white/90 tabular-nums"
          }
        >
          {clockLabel}
        </div>

        <button
          type="button"
          onClick={togglePlay}
          className={
            ghost
              ? "pointer-events-auto absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white ring-2 ring-white/45 backdrop-blur-[2px] transition hover:bg-white/25 [filter:drop-shadow(0_4px_20px_rgba(0,0,0,0.6))]"
              : "pointer-events-auto absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white ring-2 ring-white/50 backdrop-blur-sm transition hover:bg-white/30"
          }
          aria-label={playing ? "Pausar" : "Reproducir"}
        >
          {playing ? (
            <Pause size={30} strokeWidth={3.2} />
          ) : (
            <Play size={30} strokeWidth={3.2} className="ml-0.5" />
          )}
        </button>

        <div
          ref={settingsAnchorRef}
          className="pointer-events-auto absolute bottom-24 left-3 flex flex-col gap-2 text-white/95"
        >
          <button
            type="button"
            onClick={togglePiP}
            className={ghost ? sideIconBtn : "grid h-11 w-11 place-items-center rounded-lg bg-black/55 ring-1 ring-white/45 hover:bg-black/70"}
            aria-label="Vista cámara / PiP"
          >
            <Video size={20} strokeWidth={2.8} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className={
                ghost
                  ? settingsOpen
                    ? `${sideIconBtn} bg-white/25 ring-1 ring-white/40`
                    : sideIconBtn
                  : `grid h-11 w-11 place-items-center rounded-lg ring-1 ring-white/45 transition hover:bg-black/70 ${
                      settingsOpen ? "bg-black/75 ring-white/70" : "bg-black/55"
                    }`
              }
              aria-label="Ajustes"
              aria-expanded={settingsOpen}
              aria-haspopup="dialog"
            >
              <Settings size={20} strokeWidth={2.8} />
            </button>
            {settingsOpen && (
              <div
                role="dialog"
                aria-label="Ajustes de reproducción"
                className={
                  ghost
                    ? "absolute bottom-0 left-0 right-0 z-30 mx-auto w-[min(calc(100vw-2rem),18rem)] rounded-2xl p-3 sm:left-full sm:right-auto sm:mx-0 sm:ml-3 sm:w-[min(calc(100vw-5rem),17.5rem)]"
                    : "absolute bottom-0 left-full z-30 ml-3 w-[min(calc(100vw-5rem),17.5rem)] rounded-2xl bg-black/80 p-3 shadow-xl ring-1 ring-white/25 backdrop-blur-md"
                }
                style={
                  ghost
                    ? {
                        background: "rgba(15,15,15,0.45)",
                        backdropFilter: "blur(10px)",
                        WebkitBackdropFilter: "blur(10px)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                      }
                    : undefined
                }
              >
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={reportProblem}
                      className="min-h-[42px] flex-1 rounded-full bg-neutral-200 px-4 py-2 text-center text-sm font-semibold text-neutral-900 transition hover:bg-white"
                    >
                      Report problem
                    </button>
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="grid size-[42px] shrink-0 place-items-center rounded-full bg-neutral-200 text-neutral-900 transition hover:bg-white"
                      aria-label={muted ? "Activar sonido" : "Silenciar"}
                    >
                      {muted ? (
                        <VolumeX size={20} strokeWidth={2.5} />
                      ) : (
                        <Volume2 size={20} strokeWidth={2.5} />
                      )}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex min-h-[42px] flex-1 items-center justify-between gap-1 rounded-full bg-neutral-200 px-2 py-1.5 text-neutral-900">
                      <button
                        type="button"
                        className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-neutral-300 disabled:pointer-events-none disabled:opacity-35"
                        aria-label="Reducir brillo"
                        disabled={brightnessPct <= BRIGHTNESS_MIN}
                        onClick={() =>
                          setBrightnessPct((v) =>
                            Math.max(BRIGHTNESS_MIN, v - FILTER_STEP),
                          )
                        }
                      >
                        <Minus size={18} strokeWidth={2.6} />
                      </button>
                      <span className="pointer-events-none select-none text-center text-[11px] font-bold uppercase tracking-wide">
                        Brightness
                      </span>
                      <button
                        type="button"
                        className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-neutral-300 disabled:pointer-events-none disabled:opacity-35"
                        aria-label="Aumentar brillo"
                        disabled={brightnessPct >= BRIGHTNESS_MAX}
                        onClick={() =>
                          setBrightnessPct((v) =>
                            Math.min(BRIGHTNESS_MAX, v + FILTER_STEP),
                          )
                        }
                      >
                        <Plus size={18} strokeWidth={2.6} />
                      </button>
                    </div>
                    <div className="flex min-h-[42px] flex-1 items-center justify-between gap-1 rounded-full bg-neutral-200 px-2 py-1.5 text-neutral-900">
                      <button
                        type="button"
                        className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-neutral-300 disabled:pointer-events-none disabled:opacity-35"
                        aria-label="Reducir contraste"
                        disabled={contrastPct <= CONTRAST_MIN}
                        onClick={() =>
                          setContrastPct((v) =>
                            Math.max(CONTRAST_MIN, v - FILTER_STEP),
                          )
                        }
                      >
                        <Minus size={18} strokeWidth={2.6} />
                      </button>
                      <span className="pointer-events-none select-none text-center text-[11px] font-bold uppercase tracking-wide">
                        Contrast
                      </span>
                      <button
                        type="button"
                        className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-neutral-300 disabled:pointer-events-none disabled:opacity-35"
                        aria-label="Aumentar contraste"
                        disabled={contrastPct >= CONTRAST_MAX}
                        onClick={() =>
                          setContrastPct((v) =>
                            Math.min(CONTRAST_MAX, v + FILTER_STEP),
                          )
                        }
                      >
                        <Plus size={18} strokeWidth={2.6} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {ghost && (
            <>
              <a
                href={videoSrc}
                download="partido-completo.mp4"
                className={`${sideIconBtn} no-underline`}
                aria-label="Descargar partido"
              >
                <Download size={20} strokeWidth={2.8} />
              </a>
              <button
                type="button"
                onClick={() => seek(-5)}
                className={sideIconBtn}
                aria-label="Retroceder 5 segundos"
              >
                <Rewind size={20} strokeWidth={2.8} />
              </button>
            </>
          )}
        </div>

        <div className="pointer-events-auto absolute bottom-24 right-3 flex flex-col gap-2 text-white/95">
          <button
            type="button"
            onClick={toggleFullscreen}
            className={
              ghost
                ? sideIconBtn
                : "grid h-11 w-11 place-items-center rounded-lg bg-black/55 ring-1 ring-white/45 hover:bg-black/70"
            }
            aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? (
              <Minimize2 size={20} strokeWidth={2.8} />
            ) : (
              <Maximize2 size={20} strokeWidth={2.8} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setClipsOpen(!clipsOpen)}
            className={
              ghost
                ? clipsOpen
                  ? `${sideIconBtn} bg-white/20 text-vj-green ring-1 ring-vj-green/60 [filter:none]`
                  : sideIconBtn
                : `grid h-11 w-11 place-items-center rounded-lg ring-1 ring-white/45 transition ${
                    clipsOpen ? "bg-vj-green/80 hover:bg-vj-green" : "bg-black/55 hover:bg-black/70"
                  }`
            }
            aria-label={clipsOpen ? "Ocultar clips" : "Ver clips"}
            aria-expanded={clipsOpen}
          >
            <Clapperboard size={20} strokeWidth={2.8} />
          </button>
          <button
            type="button"
            onClick={share}
            className={
              ghost
                ? sideIconBtn
                : "grid h-11 w-11 place-items-center rounded-lg bg-black/55 ring-1 ring-white/45 hover:bg-black/70"
            }
            aria-label="Compartir"
          >
            <Share2 size={20} strokeWidth={2.8} />
          </button>
          <button
            type="button"
            onClick={cycleSpeed}
            className={
              ghost
                ? `${sideIconBtn} text-xs font-black`
                : "grid h-11 w-11 place-items-center rounded-lg bg-black/55 ring-1 ring-white/45 hover:bg-black/70 text-xs font-black"
            }
            aria-label="Velocidad de reproducción"
          >
            {speed}x
          </button>
          {!ghost && (
            <button
              type="button"
              onClick={toggleMute}
              className="grid h-11 w-11 place-items-center rounded-lg bg-black/55 ring-1 ring-white/45 hover:bg-black/70"
              aria-label={muted ? "Activar sonido" : "Silenciar"}
            >
              {muted ? <VolumeX size={20} strokeWidth={2.8} /> : <Volume2 size={20} strokeWidth={2.8} />}
            </button>
          )}
          {ghost && (
            <button
              type="button"
              onClick={() => seek(5)}
              className={sideIconBtn}
              aria-label="Adelantar 5 segundos"
            >
              <FastForward size={20} strokeWidth={2.8} />
            </button>
          )}
        </div>

        <div className="pointer-events-auto absolute bottom-2 left-3 right-3">
          <div className="mx-auto mb-2 flex w-20 justify-center">
            <button
              type="button"
              onClick={toggleClipRecording}
              className={
                ghost
                  ? "grid h-11 w-11 place-items-center rounded-full bg-red-600/90 text-white ring-2 ring-white/70 transition hover:bg-red-500 [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.65))]"
                  : "grid h-11 w-11 place-items-center rounded-full bg-red-600 text-white ring-2 ring-white/85 transition hover:bg-red-500"
              }
              aria-label={isClipRecording ? "Detener grabación de clip" : "Iniciar grabación de clip"}
              title={isClipRecording ? "Detener grabación de clip" : "Iniciar grabación de clip"}
            >
              {isClipRecording ? (
                <span className="h-3.5 w-3.5 rounded-sm bg-white" aria-hidden />
              ) : (
                <span className="h-5 w-5 rounded-full bg-white" aria-hidden />
              )}
            </button>
          </div>
          {isClipRecording && (
            <div className="mb-2 text-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" aria-hidden />
                Grabando clip{clipStart !== null ? ` (${formatTime(current - clipStart)})` : ""}
              </span>
            </div>
          )}
          {!ghost && (
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => seek(-5)}
                className={seekDefaultBtn}
                aria-label="Retroceder 5 segundos"
              >
                <Rewind size={20} strokeWidth={2.8} />
              </button>
              <button
                type="button"
                onClick={() => seek(5)}
                className={seekDefaultBtn}
                aria-label="Adelantar 5 segundos"
              >
                <FastForward size={20} strokeWidth={2.8} />
              </button>
            </div>
          )}
          <div
            className={
              ghost
                ? "flex items-center gap-2 text-[11px] font-semibold tabular-nums text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.85)]"
                : "flex items-center gap-2 text-[10px] font-semibold tabular-nums text-white/95"
            }
          >
            <span className="w-10 shrink-0">{formatTime(current)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.25}
              value={Math.min(current, duration || 0)}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                v.currentTime = Number(e.target.value);
                setCurrent(v.currentTime);
              }}
              className={
                ghost ? "h-1 w-full cursor-pointer accent-red-500" : "h-1.5 w-full cursor-pointer accent-white"
              }
              aria-label="Progreso del video"
            />
            <span className="w-14 shrink-0 text-right">{formatTime(duration)}</span>
          </div>
        </div>
    </>
  );

  return (
    <>
      <div
        ref={shellRef}
        className={[
          "relative aspect-video w-full overflow-hidden bg-black",
          rootClassName ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <video
          ref={videoRef}
          className={videoClassName}
          style={{
            filter: `brightness(${brightnessPct / 100}) contrast(${contrastPct / 100})`,
          }}
          src={videoSrc}
          poster={poster}
          playsInline
          preload="metadata"
          controls={false}
          onClick={togglePlay}
        />
        {!hudPortalTarget && hud}
      </div>
      {hudPortalTarget && createPortal(hud, hudPortalTarget)}

      {showClipsPanel && clipsOpen && (
        <ClipsPanel clips={DEMO_CLIPS} videoSrc={videoSrc} onSelectClip={seekTo} surface="page" />
      )}
    </>
  );
});

export default MatchPlayer;
