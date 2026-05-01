import { Download } from "lucide-react";
import type { DemoClip } from "@/components/replays/demo-clips";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function clipDownloadFilename(clip: DemoClip): string {
  const base =
    clip.label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "clip";
  return `clip-${clip.id}-${base}.mp4`;
}

export type ClipsPanelProps = {
  clips: DemoClip[];
  videoSrc: string;
  /** Nombre sugerido del archivo del partido completo */
  fullMatchDownloadName?: string;
  onSelectClip: (atSeconds: number) => void;
  /** Página clara (replay normal) vs fondo oscuro (modo cine) */
  surface?: "page" | "dark";
  sectionClassName?: string;
};

export default function ClipsPanel({
  clips,
  videoSrc,
  fullMatchDownloadName = "partido-completo.mp4",
  onSelectClip,
  surface = "page",
  sectionClassName,
}: ClipsPanelProps) {
  const isDark = surface === "dark";
  const sectionClass = [
    "w-full bg-transparent",
    isDark ? "border-t border-white/10" : "border-t border-slate-200/80",
    "pt-6 sm:pt-8",
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

  return (
    <section className={sectionClass} aria-label="Clips del partido">
      <h3 className={titleClass}>Clips</h3>
      <ul className="mt-4 flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] sm:grid sm:grid-cols-3 sm:overflow-visible">
        {clips.map((clip) => {
          const href = clip.downloadHref ?? videoSrc;
          const filename = clipDownloadFilename(clip);
          return (
            <li key={clip.id} className="min-w-[min(72vw,11.5rem)] shrink-0 sm:min-w-0">
              <div className={cardShell}>
                <div
                  className={`relative aspect-video w-full overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-100"}`}
                >
                  <button
                    type="button"
                    className="absolute inset-0 z-0 block"
                    onClick={() => onSelectClip(clip.at)}
                    aria-label={`Ir a ${clip.label}`}
                  >
                    <img
                      src={clip.thumb}
                      alt=""
                      className="h-full w-full object-cover transition group-hover/card:opacity-95"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                  <a
                    href={href}
                    download={filename}
                    onClick={(e) => e.stopPropagation()}
                    className="pointer-events-auto absolute right-1 top-1 z-10 grid size-8 place-items-center rounded-full bg-black/70 text-white shadow-md ring-1 ring-white/25 transition hover:bg-black/85"
                    aria-label={`Descargar clip: ${clip.label}`}
                  >
                    <Download size={15} strokeWidth={2.6} />
                  </a>
                  <span className="pointer-events-none absolute bottom-1 right-1 z-[5] rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                    {formatTime(clip.at)}
                  </span>
                </div>
                <button type="button" className={labelBtn} onClick={() => onSelectClip(clip.at)}>
                  {clip.label}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className={footnoteClass}>
        Datos de ejemplo. Luego se cargan desde tu backend.
      </p>
      <a
        href={videoSrc}
        download={fullMatchDownloadName}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-vj-green px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm ring-1 ring-black/10 transition hover:brightness-110"
      >
        <Download size={18} strokeWidth={2.5} className="shrink-0" aria-hidden />
        Descargar partido completo
      </a>
    </section>
  );
}
