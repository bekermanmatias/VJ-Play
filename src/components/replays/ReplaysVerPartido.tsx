import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import MatchPlayerZoom from "@/components/replays/MatchPlayerZoom";

const VIDEO_SRC =
  "https://archive.org/download/fourteenhours1951/Fourteen%20Hours%20(1951%2C%20USA)%20Featuring%20Richard%20Basehart%2C%20Paul%20Douglas%20-%20Film%20Noir%20Full%20Movie.mp4";
const POSTER =
  "https://images.unsplash.com/photo-1627615922102-6b7ef5f0ec55?auto=format&fit=crop&w=1400&q=70";

function buildTurnos() {
  const out: { value: string; label: string }[] = [];
  for (let h = 9; h <= 22; h++) {
    const value = `${h.toString().padStart(2, "0")}:00`;
    const end = h < 22 ? `${(h + 1).toString().padStart(2, "0")}:00` : "23:00";
    out.push({ value, label: `${value} — ${end}` });
  }
  return out;
}

export default function ReplaysVerPartido() {
  const turnos = useMemo(buildTurnos, []);
  const [open, setOpen] = useState(false);
  const [clockLabel, setClockLabel] = useState("--:--:--");

  useEffect(() => {
    const input = document.getElementById("replays-fecha");
    if (!(input instanceof HTMLInputElement)) return;
    const now = new Date();
    const minDate = new Date(now);
    minDate.setDate(now.getDate() - 6);
    const fmt = (d: Date) => d.toISOString().split("T")[0]!;
    input.max = fmt(now);
    input.min = fmt(minDate);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const hora = String(fd.get("hora") ?? "");
    const label =
      hora && /^\d{2}:\d{2}$/.test(hora) ? `${hora}:00` : hora || "--:--:--";
    setClockLabel(label);
    setOpen(true);
  };

  return (
    <>
      <form
        id="replays-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6"
      >
        <label className="block lg:col-span-1">
          <span className="mb-1.5 inline-block text-xs font-bold uppercase tracking-wider text-slate-600">
            Cancha
          </span>
          <div className="relative">
            <select
              id="replays-cancha"
              name="cancha"
              required
              className="h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
            >
              <option value="">Selecciona cancha</option>
              <option value="cancha-1">Cancha 1 (Blindex)</option>
              <option value="cancha-2">Cancha 2 (Muro)</option>
            </select>
          </div>
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-1">
          <label className="block">
            <span className="mb-1.5 inline-block text-xs font-bold uppercase tracking-wider text-slate-600">
              Fecha
            </span>
            <input
              id="replays-fecha"
              name="fecha"
              type="date"
              required
              className="h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 inline-block text-xs font-bold uppercase tracking-wider text-slate-600">
              Turno
            </span>
            <select
              id="replays-hora"
              name="hora"
              required
              className="h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
            >
              <option value="">Selecciona turno</option>
              {turnos.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="block lg:col-span-2">
          <span className="mb-1.5 inline-block text-xs font-bold uppercase tracking-wider text-slate-600">
            Acción
          </span>
          <button
            type="submit"
            className="h-12 w-full rounded-md bg-vj-green px-4 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-vj-green-600"
          >
            VER PARTIDO
          </button>
        </div>
      </form>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reproductor de replay"
          className="fixed inset-0 z-[200] h-[100dvh] max-h-[100dvh] overflow-hidden bg-black"
        >
          <div className="pointer-events-none absolute right-0 top-0 z-[210] flex justify-end p-3 sm:p-4">
            <button
              type="button"
              onClick={close}
              className="pointer-events-auto grid size-11 place-items-center rounded-full text-white [filter:drop-shadow(0_2px_8px_rgba(0,0,0,0.85))] transition hover:bg-white/15"
              aria-label="Cerrar reproductor"
            >
              <X size={26} strokeWidth={2.5} />
            </button>
          </div>
          {/* Altura explícita para que position:absolute bottom-* del player sea respecto al viewport */}
          <div className="absolute inset-0 top-0 min-h-0 w-full">
            <MatchPlayerZoom
              videoSrc={VIDEO_SRC}
              poster={POSTER}
              clockLabel={clockLabel}
              chromeVariant="ghost"
              layout="fill"
            />
          </div>
        </div>
      )}
    </>
  );
}
