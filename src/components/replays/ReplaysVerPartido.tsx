import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import MatchPlayerZoom from "@/components/replays/MatchPlayerZoom";

const VIDEO_SRC =
  "https://archive.org/download/fourteenhours1951/Fourteen%20Hours%20(1951%2C%20USA)%20Featuring%20Richard%20Basehart%2C%20Paul%20Douglas%20-%20Film%20Noir%20Full%20Movie.mp4";
const POSTER =
  "https://images.unsplash.com/photo-1627615922102-6b7ef5f0ec55?auto=format&fit=crop&w=1400&q=70";

type Option = { value: string; label: string };

const CANCHAS: Option[] = [
  { value: "cancha-padel", label: "Cancha Padel" },
  { value: "cancha-f5", label: "Cancha F5" },
];

function buildTurnos() {
  const out: Option[] = [];
  for (let h = 9; h <= 22; h++) {
    const value = `${h.toString().padStart(2, "0")}:00`;
    const end = h < 22 ? `${(h + 1).toString().padStart(2, "0")}:00` : "23:00";
    out.push({ value, label: `${value} - ${end}` });
  }
  return out;
}

function buildFechas() {
  const now = new Date();
  const out: Option[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const value = d.toISOString().split("T")[0] ?? "";
    const label = d.toLocaleDateString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    out.push({ value, label });
  }
  return out;
}

type DropdownFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  options: Option[];
  value: string;
  open: boolean;
  showCalendarIcon?: boolean;
  onToggle: () => void;
  onPick: (value: string) => void;
};

function DropdownField({
  id,
  label,
  placeholder,
  options,
  value,
  open,
  showCalendarIcon = false,
  onToggle,
  onPick,
}: DropdownFieldProps) {
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <span className="mb-1.5 inline-block text-xs font-bold uppercase tracking-wider text-slate-600">
        {label}
      </span>
      <button
        id={id}
        type="button"
        onClick={onToggle}
        className={`relative h-12 w-full rounded-md border border-slate-300 bg-white pl-3 text-left text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-vj-green ${showCalendarIcon ? "pr-14" : "pr-10"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`block truncate ${selected ? "text-slate-800" : "text-slate-500"}`}>
          {selected?.label ?? placeholder}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5">
          {showCalendarIcon && <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden />}
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className="absolute z-40 mt-2 max-h-64 w-full overflow-auto border border-slate-300 bg-white p-1 shadow-lg"
        >
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => onPick(opt.value)}
                className={`block w-full px-3 py-2 text-left text-sm font-semibold transition-colors ${
                  value === opt.value
                    ? "bg-vj-green text-white"
                    : "text-slate-700 hover:bg-vj-green hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReplaysVerPartido() {
  const turnos = useMemo(buildTurnos, []);
  const fechas = useMemo(buildFechas, []);
  const [open, setOpen] = useState(false);
  const [clockLabel, setClockLabel] = useState("--:--:--");
  const [cancha, setCancha] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [openMenu, setOpenMenu] = useState<"cancha" | "fecha" | "hora" | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node)) return;
      if (formRef.current?.contains(e.target)) return;
      setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

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
    if (!cancha || !fecha || !hora) {
      window.alert("Complet? cancha, fecha y turno para continuar.");
      return;
    }
    const label = /^\d{2}:\d{2}$/.test(hora) ? `${hora}:00` : hora || "--:--:--";
    setClockLabel(label);
    setOpen(true);
    setOpenMenu(null);
  };

  return (
    <>
      <form
        ref={formRef}
        id="replays-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6"
      >
        <input type="hidden" name="cancha" value={cancha} />
        <input type="hidden" name="fecha" value={fecha} />
        <input type="hidden" name="hora" value={hora} />

        <div className="block lg:col-span-1">
          <DropdownField
            id="replays-cancha"
            label="Cancha"
            placeholder="Selecciona cancha"
            options={CANCHAS}
            value={cancha}
            open={openMenu === "cancha"}
            onToggle={() => setOpenMenu((v) => (v === "cancha" ? null : "cancha"))}
            onPick={(v) => {
              setCancha(v);
              setOpenMenu(null);
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-1">
          <div className="block">
            <DropdownField
              id="replays-fecha"
              label="Fecha"
              placeholder="Selecciona fecha"
              options={fechas}
              value={fecha}
              open={openMenu === "fecha"}
              showCalendarIcon
              onToggle={() => setOpenMenu((v) => (v === "fecha" ? null : "fecha"))}
              onPick={(v) => {
                setFecha(v);
                setOpenMenu(null);
              }}
            />
          </div>

          <div className="block">
            <DropdownField
              id="replays-hora"
              label="Turno"
              placeholder="Selecciona turno"
              options={turnos}
              value={hora}
              open={openMenu === "hora"}
              onToggle={() => setOpenMenu((v) => (v === "hora" ? null : "hora"))}
              onPick={(v) => {
                setHora(v);
                setOpenMenu(null);
              }}
            />
          </div>
        </div>

        <div className="block lg:col-span-2">
          <span className="mb-1.5 inline-block text-xs font-bold uppercase tracking-wider text-slate-600">
            Accion
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
          className="fixed inset-x-0 bottom-0 z-50 overflow-hidden bg-black"
          style={{
            top: "var(--mobile-nav-offset, 0px)",
            height: "calc(100dvh - var(--mobile-nav-offset, 0px))",
          }}
        >
          <div className="pointer-events-none absolute right-0 top-0 z-60 flex justify-end p-3 sm:p-4">
            <button
              type="button"
              onClick={close}
              className="pointer-events-auto grid size-11 place-items-center rounded-full text-white filter-[drop-shadow(0_2px_8px_rgba(0,0,0,0.85))] transition hover:bg-white/15"
              aria-label="Cerrar reproductor"
            >
              <X size={26} strokeWidth={2.5} />
            </button>
          </div>
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