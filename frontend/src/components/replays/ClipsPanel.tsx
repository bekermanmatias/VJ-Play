import { Download, EllipsisVertical, Loader2, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { replayClipDownloadFilename, type ReplayClipItem } from "@/components/replays/clip-types";
import { matchKeyToDownloadFileStem } from "@/utils/replay-download-filename";

const CLIP_THUMB_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='#0f172a'/>
          <stop offset='100%' stop-color='#111827'/>
        </linearGradient>
      </defs>
      <rect width='320' height='180' fill='url(#g)'/>
      <text x='160' y='95' text-anchor='middle' fill='#93a3b8' font-family='Inter, Arial' font-size='13'>Cargando miniatura…</text>
    </svg>`,
  );

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export type ClipsPanelProps = {
  clips: ReplayClipItem[];
  videoSrc: string;
  /** Nombre sugerido del archivo del partido completo (opcional; si hay matchKey se ignora salvo que no haya matchKey). */
  fullMatchDownloadName?: string;
  /** match_key `cancha|fecha|hora` para armar nombres `cancha-fecha-hora` y clips `nombre-cancha-fecha-hora`. */
  matchKey?: string;
  /** Peso del archivo del partido completo (bytes). */
  fullMatchSizeBytes?: number | null;
  onSelectClip: (atSeconds: number) => void;
  /** Página clara (replay normal) vs fondo oscuro (modo cine) */
  surface?: "page" | "dark";
  sectionClassName?: string;
  layout?: "default" | "side";
  onRenameClip?: (clipId: string, nextLabel: string) => void;
  onDeleteClip?: (clipId: string) => void;
  /** Descarga con sesión (p. ej. proxy del API); si no hay, se usa la URL pública del clip. */
  onAuthorizedDownload?: (clip: ReplayClipItem) => void | Promise<void>;
  /** Partido completo vía API con sesión; muestra espera mientras se prepara el archivo. */
  onAuthorizedFullMatchDownload?: (fileName: string) => void | Promise<void>;
};

export default function ClipsPanel({
  clips,
  videoSrc,
  fullMatchDownloadName,
  matchKey = "",
  fullMatchSizeBytes = null,
  onSelectClip,
  surface = "page",
  sectionClassName,
  layout = "default",
  onRenameClip,
  onDeleteClip,
  onAuthorizedDownload,
  onAuthorizedFullMatchDownload,
}: ClipsPanelProps) {
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [downloadPendingFor, setDownloadPendingFor] = useState<string | null>(null);
  const [fullMatchDownloadPending, setFullMatchDownloadPending] = useState(false);

  const resolvedFullMatchDownloadName = useMemo(() => {
    if (matchKey.trim()) {
      return `${matchKeyToDownloadFileStem(matchKey)}.mp4`;
    }
    const custom = typeof fullMatchDownloadName === "string" ? fullMatchDownloadName.trim() : "";
    return custom || "partido-completo.mp4";
  }, [matchKey, fullMatchDownloadName]);
  const isDark = surface === "dark";
  const isSide = layout === "side";
  const sectionClass = [
    "w-full bg-transparent",
    isSide
      ? ""
      : isDark
        ? "border-t border-white/10 pt-6 sm:pt-8"
        : "border-t border-slate-200/80 pt-6 sm:pt-8",
    isSide ? "flex h-full min-h-0 flex-col overflow-hidden" : "",
    sectionClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const titleClass = isDark
    ? "text-sm font-bold uppercase tracking-wide text-white"
    : "text-sm font-bold uppercase tracking-wide text-slate-900";

  const cardShell =
    isDark
      ? "group/card overflow-hidden rounded-lg border border-white/15 bg-white/5 text-left ring-1 ring-transparent transition hover:border-vj-green hover:ring-vj-green/30"
      : "group/card overflow-hidden rounded-lg border border-slate-200 bg-transparent text-left transition hover:border-vj-green";

  const labelBtn =
    isDark
      ? "w-full px-2 py-2 text-left text-xs font-semibold text-white/95 transition hover:bg-white/5"
      : "w-full px-2 py-2 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-50";

  const footnoteClass = isDark ? "mt-3 text-[10px] text-white/50" : "mt-3 text-[10px] text-slate-500";
  const listClass = isSide
    ? "vj-scrollbar vj-scrollbar-dark mt-4 grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1"
    : "mt-4 flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] sm:grid sm:grid-cols-3 sm:overflow-visible";

  return (
    <section className={sectionClass} aria-label="Clips del partido">
      <h3 className={titleClass}>Clips</h3>
      <ul className={listClass}>
        {clips.map((clip) => {
          const href =
            clip.status && clip.status !== "ready"
              ? "#"
              : clip.downloadHref ?? videoSrc;
          const filename = replayClipDownloadFilename(clip, matchKey);
          const isGenerating = clip.status === "processing";
          const isDownloadLoading = downloadPendingFor === clip.id;
          const showClipBusyOverlay = isGenerating || isDownloadLoading;
          return (
            <li
              key={clip.id}
              className={isSide ? "min-w-0" : "min-w-[min(72vw,11.5rem)] shrink-0 sm:min-w-0"}
            >
              <div className={cardShell}>
                <div
                  className={`relative aspect-video w-full overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-100"}`}
                >
                  <button
                    type="button"
                    className="absolute inset-0 z-0 block"
                    onClick={() => onSelectClip(clip.at)}
                    aria-label={`Ir a ${clip.label}`}
                    disabled={isDownloadLoading}
                  >
                    <img
                      src={clip.thumb || CLIP_THUMB_FALLBACK}
                      alt=""
                      className="h-full w-full object-cover transition group-hover/card:opacity-95"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.src !== CLIP_THUMB_FALLBACK) {
                          img.src = CLIP_THUMB_FALLBACK;
                        }
                      }}
                    />
                  </button>
                  {showClipBusyOverlay && (
                    <div
                      className="pointer-events-none absolute inset-0 z-[15] flex flex-col items-center justify-center gap-2 bg-black/60 px-3 text-center backdrop-blur-[2px]"
                      role="status"
                      aria-live="polite"
                      aria-busy="true"
                    >
                      <Loader2
                        className="size-9 shrink-0 animate-spin text-white"
                        strokeWidth={2.4}
                        aria-hidden
                      />
                      <span className="text-[11px] font-semibold leading-tight text-white">
                        {isGenerating ? "Generando clip…" : "Preparando descarga…"}
                      </span>
                      <span className="text-[10px] font-medium leading-tight text-white/80">
                        {isGenerating
                          ? "Puede tardar un momento."
                          : "Esperá mientras armamos el archivo."}
                      </span>
                    </div>
                  )}
                  <a
                    href={href}
                    download={filename}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (clip.status && clip.status !== "ready") {
                        e.preventDefault();
                      }
                    }}
                    className={`pointer-events-auto absolute right-1 top-1 z-10 grid size-8 place-items-center rounded-full shadow-md ring-1 ring-white/25 transition ${
                      clip.status === "processing"
                        ? "cursor-wait bg-black/45 text-white/60"
                        : clip.status === "failed"
                          ? "cursor-not-allowed bg-rose-900/60 text-rose-100"
                          : "bg-black/70 text-white hover:bg-black/85"
                    }`}
                    aria-label={`Descargar clip: ${clip.label}`}
                    aria-disabled={clip.status !== undefined && clip.status !== "ready"}
                    style={{ display: "none" }}
                  >
                    <Download size={15} strokeWidth={2.6} />
                  </a>
                  <div className="absolute right-1 top-1 z-20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenFor((prev) => (prev === clip.id ? null : clip.id));
                      }}
                      className="grid size-8 place-items-center rounded-full bg-black/70 text-white shadow-md ring-1 ring-white/25 transition hover:bg-black/85"
                      aria-label={`Opciones del clip ${clip.label}`}
                    >
                      <EllipsisVertical size={15} strokeWidth={2.6} />
                    </button>
                    {menuOpenFor === clip.id && (
                      <div
                        className="absolute right-0 mt-1 w-40 overflow-hidden rounded-md border border-white/15 bg-black/90 shadow-xl ring-1 ring-black/40"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={clip.status !== "ready" || isDownloadLoading}
                          onClick={() => {
                            if (clip.status !== "ready" || isDownloadLoading) return;
                            if (onAuthorizedDownload) {
                              setMenuOpenFor(null);
                              setDownloadPendingFor(clip.id);
                              void Promise.resolve(onAuthorizedDownload(clip)).finally(() => {
                                setDownloadPendingFor(null);
                              });
                              return;
                            }
                            const link = document.createElement("a");
                            link.href = href;
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            setMenuOpenFor(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/45"
                        >
                          {isDownloadLoading ? (
                            <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
                          ) : (
                            <Download size={14} />
                          )}
                          {isDownloadLoading ? "Descargando…" : "Descargar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const current = clip.label.trim();
                            const next = window.prompt("Nuevo nombre del clip", current);
                            if (!next) return;
                            const cleaned = next.trim();
                            if (!cleaned) return;
                            onRenameClip?.(clip.id, cleaned);
                            setMenuOpenFor(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-white/10"
                        >
                          <Pencil size={14} />
                          Renombrar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const ok = window.confirm("¿Querés borrar este clip?");
                            if (!ok) return;
                            onDeleteClip?.(clip.id);
                            setMenuOpenFor(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                        >
                          <Trash2 size={14} />
                          Borrar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <button type="button" className={labelBtn} onClick={() => onSelectClip(clip.at)}>
                  {clip.label}
                  {clip.status === "processing" && " · Procesando..."}
                  {clip.status === "failed" && " · Error al generar"}
                </button>
                <div className={isDark ? "flex items-center justify-between px-2 pb-2 text-[11px] text-white/70" : "flex items-center justify-between px-2 pb-2 text-[11px] text-slate-600"}>
                  <span>
                    {formatTime(clip.at)} - {formatTime(clip.endAt ?? clip.at + (clip.durationSeconds ?? 0))}
                  </span>
                  <span>
                    {formatTime(clip.durationSeconds ?? Math.max(0, (clip.endAt ?? clip.at) - clip.at))} · {formatBytes(clip.clipSizeBytes)}
                  </span>
                </div>
                {clip.status === "failed" && clip.error && (
                  <p className={isDark ? "px-2 pb-2 text-[11px] text-rose-300" : "px-2 pb-2 text-[11px] text-rose-700"}>
                    {clip.error}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {clips.length === 0 && (
        <p className={isDark ? "mt-3 text-xs text-white/65" : "mt-3 text-xs text-slate-600"}>
          Todavia no hay clips. Usa el boton rojo para grabar uno desde el video.
        </p>
      )}
      <p className={footnoteClass}>Los clips se generan sobre este partido.</p>
      {onAuthorizedFullMatchDownload ? (
        <button
          type="button"
          disabled={fullMatchDownloadPending}
          aria-busy={fullMatchDownloadPending}
          onClick={() => {
            setFullMatchDownloadPending(true);
            void Promise.resolve(onAuthorizedFullMatchDownload(resolvedFullMatchDownloadName)).finally(() => {
              setFullMatchDownloadPending(false);
            });
          }}
          className={`mt-4 flex w-full flex-col items-center justify-center gap-1 rounded-lg px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm ring-1 ring-black/10 transition ${
            fullMatchDownloadPending
              ? "cursor-wait bg-vj-green/85 ring-black/10"
              : "cursor-pointer bg-vj-green hover:brightness-110"
          } disabled:opacity-95`}
        >
          <span className="flex items-center justify-center gap-2">
            {fullMatchDownloadPending ? (
              <Loader2 size={18} strokeWidth={2.5} className="shrink-0 animate-spin" aria-hidden />
            ) : (
              <Download size={18} strokeWidth={2.5} className="shrink-0" aria-hidden />
            )}
            {fullMatchDownloadPending ? "Preparando tu archivo…" : "Descargar partido completo"}
          </span>
          {fullMatchDownloadPending ? (
            <>
              <span className="text-[11px] font-semibold normal-case tracking-normal leading-snug text-white/95">
                Estamos generando el archivo para descargar. Aguardá un momento…
              </span>
              {typeof fullMatchSizeBytes === "number" && fullMatchSizeBytes > 0 ? (
                <span className="text-[10px] font-medium normal-case tracking-normal text-white/85">
                  Peso aproximado: {formatBytes(fullMatchSizeBytes)}
                </span>
              ) : null}
            </>
          ) : typeof fullMatchSizeBytes === "number" && fullMatchSizeBytes > 0 ? (
            <span className="text-[11px] font-semibold normal-case tracking-normal text-white/90">
              Peso aproximado: {formatBytes(fullMatchSizeBytes)}
            </span>
          ) : null}
        </button>
      ) : (
        <a
          href={videoSrc}
          download={resolvedFullMatchDownloadName}
          className="mt-4 flex w-full flex-col items-center justify-center gap-1 rounded-lg bg-vj-green px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm ring-1 ring-black/10 transition hover:brightness-110"
        >
          <span className="flex items-center justify-center gap-2">
            <Download size={18} strokeWidth={2.5} className="shrink-0" aria-hidden />
            Descargar partido completo
          </span>
          {typeof fullMatchSizeBytes === "number" && fullMatchSizeBytes > 0 ? (
            <span className="text-[11px] font-semibold normal-case tracking-normal text-white/90">
              Peso aproximado: {formatBytes(fullMatchSizeBytes)}
            </span>
          ) : null}
        </a>
      )}
    </section>
  );
}
