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
  FastForward,
  Maximize2,
  Minimize2,
  Minus,
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
import type { ReplayClipItem } from "@/components/replays/clip-types";

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
  /** Base del API backend para generar recortes reales. */
  clipApiBase?: string;
  /** Match actual para vincular clips persistentes. */
  matchKey?: string;
  /** Sesión de replay para listar clips ya existentes del partido. */
  sessionToken?: string | null;
  /** Propaga la lista de clips para paneles externos al player. */
  onClipsUpdate?: (clips: ReplayClipItem[]) => void;
};

type PendingClip = {
  start: number;
  end: number;
  duration: number;
};

type SavedClipNotice = {
  name: string;
  start: number;
  end: number;
};

type ClipJobNotice = {
  name: string;
  status: "processing" | "failed";
  error?: string;
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
    clipApiBase = "",
    matchKey = "",
    sessionToken = null,
    onClipsUpdate,
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
  const pointerDragStateRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
  });
  const suppressNextClickRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isClipRecording, setIsClipRecording] = useState(false);
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [pendingClip, setPendingClip] = useState<PendingClip | null>(null);
  const [clipDraftName, setClipDraftName] = useState("");
  const [savedClipNotice, setSavedClipNotice] = useState<SavedClipNotice | null>(null);
  const [clipJobNotice, setClipJobNotice] = useState<ClipJobNotice | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uncontrolledClipsOpen, setUncontrolledClipsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [brightnessPct, setBrightnessPct] = useState(100);
  const [contrastPct, setContrastPct] = useState(100);
  const [clips, setClips] = useState<ReplayClipItem[]>([]);

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
    const getFullscreenHost = () => {
      if (hudPortalTarget?.parentElement) {
        return hudPortalTarget.parentElement;
      }
      return shellRef.current;
    };

    const syncFs = () => {
      const host = getFullscreenHost();
      const fsEl = document.fullscreenElement;
      if (!host || !fsEl) {
        setIsFullscreen(false);
        return;
      }
      setIsFullscreen(fsEl === host);
    };

    syncFs();
    document.addEventListener("fullscreenchange", syncFs);
    return () => document.removeEventListener("fullscreenchange", syncFs);
  }, [hudPortalTarget]);

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

  useEffect(() => {
    onClipsUpdate?.(clips);
  }, [clips, onClipsUpdate]);

  useEffect(() => {
    const apiBase = clipApiBase.trim().replace(/\/$/, "");
    const mk = matchKey.trim();
    const token = typeof sessionToken === "string" ? sessionToken.trim() : "";
    if (!apiBase || !mk || !token) {
      return;
    }
    let cancelled = false;
    void fetch(`${apiBase}/api/replays/access/clips`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | {
              clips?: Array<{
                id?: string;
                clipUrl?: string;
                thumbUrl?: string | null;
                clipLabel?: string | null;
                startSeconds?: number;
                durationSeconds?: number;
                clipSizeBytes?: number | null;
              }>;
              error?: string;
            }
          | null;
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(body?.error ?? "No se pudieron cargar clips.");
        }
        const remote = (body?.clips ?? [])
          .map((row): ReplayClipItem | null => {
            const id = typeof row.id === "string" ? row.id : "";
            const clipUrl = typeof row.clipUrl === "string" ? row.clipUrl : "";
            const thumbUrl =
              typeof row.thumbUrl === "string" && row.thumbUrl.trim() !== ""
                ? row.thumbUrl
                : null;
            const clipLabel =
              typeof row.clipLabel === "string" && row.clipLabel.trim() !== ""
                ? row.clipLabel
                : null;
            const at = typeof row.startSeconds === "number" ? row.startSeconds : 0;
            const durationSeconds =
              typeof row.durationSeconds === "number" ? row.durationSeconds : 0;
            const clipSizeBytes =
              typeof row.clipSizeBytes === "number" ? row.clipSizeBytes : null;
            if (!id || !clipUrl) return null;
            return {
              id,
              label: clipLabel ?? `Clip ${formatTime(at)}`,
              at,
              endAt: at + Math.max(0, durationSeconds),
              thumb: thumbUrl ?? poster ?? "",
              downloadHref: clipUrl,
              durationSeconds,
              clipSizeBytes,
              status: "ready",
              error: null,
            };
          })
          .filter((v): v is ReplayClipItem => v !== null);
        setClips((prev) => {
          const processing = prev.filter((c) => c.status === "processing");
          const failed = prev.filter((c) => c.status === "failed");
          return [...processing, ...failed, ...remote];
        });
      })
      .catch(() => {
        // Silencioso: el usuario aún puede crear clips nuevos.
      });
    return () => {
      cancelled = true;
    };
  }, [clipApiBase, matchKey, poster, sessionToken]);

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

  const onVideoPointerDown = (e: React.PointerEvent<HTMLVideoElement>) => {
    pointerDragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
  };

  const onVideoPointerMove = (e: React.PointerEvent<HTMLVideoElement>) => {
    const st = pointerDragStateRef.current;
    if (st.pointerId !== e.pointerId) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.moved && Math.hypot(dx, dy) > 6) {
      st.moved = true;
      suppressNextClickRef.current = true;
    }
  };

  const onVideoPointerUp = (e: React.PointerEvent<HTMLVideoElement>) => {
    const st = pointerDragStateRef.current;
    if (st.pointerId !== e.pointerId) return;
    if (st.moved) {
      suppressNextClickRef.current = true;
    }
    pointerDragStateRef.current.pointerId = null;
  };

  const onVideoPointerCancel = () => {
    pointerDragStateRef.current.pointerId = null;
    pointerDragStateRef.current.moved = false;
  };

  const onVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    void togglePlay();
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
    const host = hudPortalTarget?.parentElement ?? shellRef.current;
    if (!host) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await host.requestFullscreen();
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
    const end = v.currentTime;
    const start = clipStart ?? Math.max(0, end - 10);
    const duration = Math.max(0, end - start);
    setIsClipRecording(false);
    setClipStart(null);
    setClipDraftName("");
    setPendingClip({ start, end, duration });
  };

  const closeClipModal = () => {
    setPendingClip(null);
    setClipDraftName("");
  };

  const saveClipDraft = () => {
    if (!pendingClip) return;
    const fallback = `Clip ${new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    const clipName = clipDraftName.trim() || fallback;
    setClipJobNotice({ name: clipName, status: "processing" });
    const createdAt = Date.now();
    const localId = `clip-${createdAt}-${Math.random().toString(36).slice(2, 8)}`;
    const nextClip: ReplayClipItem = {
      id: localId,
      label: clipName,
      at: pendingClip.start,
      endAt: pendingClip.end,
      thumb: poster || "",
      durationSeconds: pendingClip.duration,
      status: "processing",
    };
    setClips((prev) => [nextClip, ...prev]);
    const apiBase = clipApiBase.trim().replace(/\/$/, "");
    if (!apiBase) {
      setClips((prev) =>
        prev.map((clip) =>
          clip.id === localId
            ? {
                ...clip,
                status: "failed",
                error: "Falta configurar PUBLIC_REPLAY_API_BASE.",
              }
            : clip,
        ),
      );
      closeClipModal();
      return;
    }
    void (async () => {
      try {
        const createRes = await fetch(`${apiBase}/api/videos/clip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceUrl: videoSrc,
            startSeconds: pendingClip.start,
            endSeconds: pendingClip.end,
            clipLabel: clipName,
            matchKey: matchKey.trim() || undefined,
          }),
        });
        const createBody = (await createRes.json().catch(() => null)) as
          | { jobId?: string; error?: string }
          | null;
        if (!createRes.ok || !createBody?.jobId) {
          throw new Error(createBody?.error ?? "No se pudo encolar el clip.");
        }
        const jobId = createBody.jobId;
        let completedUrl = "";
        for (let i = 0; i < 600; i += 1) {
          await new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), 1000);
          });
          const jobRes = await fetch(`${apiBase}/api/videos/clip/${encodeURIComponent(jobId)}`);
          const jobBody = (await jobRes.json().catch(() => null)) as
            | { status?: string; publicUrl?: string; error?: string }
            | null;
          if (!jobRes.ok) {
            throw new Error(jobBody?.error ?? "No se pudo consultar el clip.");
          }
          if (jobBody?.status === "completed" && typeof jobBody.publicUrl === "string") {
            completedUrl = jobBody.publicUrl;
            break;
          }
          if (jobBody?.status === "failed") {
            throw new Error(jobBody?.error ?? "Falló la generación del clip.");
          }
        }
        if (!completedUrl) {
          throw new Error("El clip tardó demasiado en procesarse.");
        }
        setClips((prev) =>
          prev.map((clip) =>
            clip.id === localId
              ? { ...clip, status: "ready", downloadHref: completedUrl, error: null }
              : clip,
          ),
        );
        setClipJobNotice(null);
        setSavedClipNotice({
          name: clipName,
          start: pendingClip.start,
          end: pendingClip.end,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo generar el clip.";
        setClips((prev) =>
          prev.map((clip) =>
            clip.id === localId ? { ...clip, status: "failed", error: message } : clip,
          ),
        );
        setClipJobNotice({ name: clipName, status: "failed", error: message });
      }
    })();
    closeClipModal();
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

        {!playing && (
          <button
            type="button"
            onClick={togglePlay}
            className={
              ghost
                ? "pointer-events-auto absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white ring-2 ring-white/45 backdrop-blur-[2px] transition hover:bg-white/25 [filter:drop-shadow(0_4px_20px_rgba(0,0,0,0.6))]"
                : "pointer-events-auto absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white ring-2 ring-white/50 backdrop-blur-sm transition hover:bg-white/30"
            }
            aria-label="Reproducir"
          >
            <Play size={30} strokeWidth={3.2} className="ml-0.5" />
          </button>
        )}

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
            <button
              type="button"
              onClick={() => seek(-5)}
              className={sideIconBtn}
              aria-label="Retroceder 5 segundos"
            >
              <Rewind size={20} strokeWidth={2.8} />
            </button>
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
        {pendingClip && (
          <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/55 p-3">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
              <h4 className="text-sm font-black uppercase tracking-wide text-slate-800">
                Guardar clip
              </h4>
              <p className="mt-1 text-xs text-slate-600">
                Tu recorte termino correctamente. Podes guardarlo con nombre opcional.
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 text-[11px] font-semibold text-slate-700">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Inicio</p>
                  <p>{formatTime(pendingClip.start)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Fin</p>
                  <p>{formatTime(pendingClip.end)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Duracion</p>
                  <p>{formatTime(pendingClip.duration)}</p>
                </div>
              </div>

              <label className="mt-3 block">
                <span className="mb-1 inline-block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Nombre del clip (opcional)
                </span>
                <input
                  type="text"
                  value={clipDraftName}
                  onChange={(e) => setClipDraftName(e.target.value)}
                  placeholder="Ej: Punto final set 2"
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
                />
              </label>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeClipModal}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveClipDraft}
                  className="rounded-md bg-vj-green px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-vj-green-600"
                >
                  Guardar clip
                </button>
              </div>
            </div>
          </div>
        )}
        {savedClipNotice && (
          <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-black/60 p-3">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
              <h4 className="text-sm font-black uppercase tracking-wide text-slate-800">
                Clip guardado
              </h4>
              <p className="mt-2 text-sm text-slate-700">
                Se guardo como:
                <span className="ml-1 font-black text-slate-900">{savedClipNotice.name}</span>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Rango: {formatTime(savedClipNotice.start)} - {formatTime(savedClipNotice.end)}
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSavedClipNotice(null)}
                  className="rounded-md bg-vj-green px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-vj-green-600"
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}
        {clipJobNotice && (
          <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-black/60 p-3">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
              <h4 className="text-sm font-black uppercase tracking-wide text-slate-800">
                {clipJobNotice.status === "processing" ? "Generando clip" : "Error al generar clip"}
              </h4>
              {clipJobNotice.status === "processing" ? (
                <>
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-black text-slate-900">{clipJobNotice.name}</span> se está procesando.
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Esperá unos instantes. El clip aparecerá listo para descargar automáticamente.
                  </p>
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-vj-green" />
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-slate-700">
                    No se pudo generar <span className="font-black text-slate-900">{clipJobNotice.name}</span>.
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{clipJobNotice.error ?? "Intentá nuevamente."}</p>
                </>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setClipJobNotice(null)}
                  className="rounded-md bg-vj-green px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-vj-green-600"
                >
                  {clipJobNotice.status === "processing" ? "Entendido" : "Cerrar"}
                </button>
              </div>
            </div>
          </div>
        )}
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
          onPointerDown={onVideoPointerDown}
          onPointerMove={onVideoPointerMove}
          onPointerUp={onVideoPointerUp}
          onPointerCancel={onVideoPointerCancel}
          onClick={onVideoClick}
        />
        {!hudPortalTarget && hud}
      </div>
      {hudPortalTarget && createPortal(hud, hudPortalTarget)}

      {showClipsPanel && clipsOpen && (
        <ClipsPanel
          clips={clips}
          videoSrc={videoSrc}
          onSelectClip={seekTo}
          onRenameClip={(clipId, nextLabel) => {
            setClips((prev) =>
              prev.map((clip) => (clip.id === clipId ? { ...clip, label: nextLabel } : clip)),
            );
          }}
          onDeleteClip={(clipId) => {
            setClips((prev) => prev.filter((clip) => clip.id !== clipId));
          }}
          surface="page"
        />
      )}
    </>
  );
});

export default MatchPlayer;
