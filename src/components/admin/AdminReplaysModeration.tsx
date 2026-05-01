import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Eye, EyeOff, Star, Trash2 } from "lucide-react";
import ReplayMatchBlock from "@/components/replays/ReplayMatchBlock";

type Option = { value: string; label: string };

type MatchResult = {
  court: string;
  date: string;
  time: string;
};

const COURTS: Option[] = [
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

function buildDates() {
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
          <ChevronDown className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`} aria-hidden />
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

const videoSrc =
  "https://archive.org/download/fourteenhours1951/Fourteen%20Hours%20(1951%2C%20USA)%20Featuring%20Richard%20Basehart%2C%20Paul%20Douglas%20-%20Film%20Noir%20Full%20Movie.mp4";
const poster =
  "https://images.unsplash.com/photo-1627615922102-6b7ef5f0ec55?auto=format&fit=crop&w=1400&q=70";

export default function AdminReplaysModeration() {
  const dates = useMemo(buildDates, []);
  const turnos = useMemo(buildTurnos, []);

  const [court, setCourt] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [openMenu, setOpenMenu] = useState<"court" | "date" | "time" | null>(null);

  const [result, setResult] = useState<MatchResult | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!court || !date || !time) {
      window.alert("Selecciona cancha, fecha y horario para buscar el bloque.");
      return;
    }
    const courtLabel = COURTS.find((c) => c.value === court)?.label ?? court;
    const dateLabel = dates.find((d) => d.value === date)?.label ?? date;

    setResult({
      court: courtLabel,
      date: dateLabel,
      time,
    });
    setIsPublic(true);
    setIsDeleted(false);
    setIsFeatured(false);
    setOpenMenu(null);
  };

  return (
    <div>
      <section className="py-1">
        <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Replays</h2>
        <p className="mt-2 max-w-3xl text-base text-slate-700">
          Buscador igual a la vista publica con herramientas de moderacion para recepcion.
        </p>
      </section>

      <section className="mt-6">
        <form onSubmit={onSearch} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <DropdownField
            id="admin-court"
            label="Cancha"
            placeholder="Selecciona cancha"
            options={COURTS}
            value={court}
            open={openMenu === "court"}
            onToggle={() => setOpenMenu((v) => (v === "court" ? null : "court"))}
            onPick={(v) => {
              setCourt(v);
              setOpenMenu(null);
            }}
          />

          <DropdownField
            id="admin-date"
            label="Fecha"
            placeholder="Selecciona fecha"
            options={dates}
            value={date}
            open={openMenu === "date"}
            showCalendarIcon
            onToggle={() => setOpenMenu((v) => (v === "date" ? null : "date"))}
            onPick={(v) => {
              setDate(v);
              setOpenMenu(null);
            }}
          />

          <DropdownField
            id="admin-time"
            label="Horario"
            placeholder="Selecciona horario"
            options={turnos}
            value={time}
            open={openMenu === "time"}
            onToggle={() => setOpenMenu((v) => (v === "time" ? null : "time"))}
            onPick={(v) => {
              setTime(v);
              setOpenMenu(null);
            }}
          />

          <div className="lg:col-span-3">
            <button
              type="submit"
              className="h-12 w-full rounded-md bg-vj-green px-4 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-vj-green-600"
            >
              Buscar bloque
            </button>
          </div>
        </form>
      </section>

      {result && (
        <section className="mt-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {result.court}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {result.date} | Horario {result.time}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                  isDeleted
                    ? "bg-rose-100 text-rose-700"
                    : isPublic
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                }`}
              >
                {isDeleted ? "Eliminado" : isPublic ? "Visible en publico" : "Oculto en publico"}
              </span>
              {isFeatured && (
                <span className="inline-flex rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-700">
                  Destacado en Home
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsPublic((v) => !v)}
              disabled={isDeleted}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Cambia is_public en la base"
            >
              {isPublic ? <EyeOff size={16} /> : <Eye size={16} />}
              {isPublic ? "Ocultar de la vista publica" : "Mostrar en la vista publica"}
            </button>

            <button
              type="button"
              onClick={() => {
                const ok = window.confirm("Esta accion elimina el archivo de forma permanente. Continuar?");
                if (ok) setIsDeleted(true);
              }}
              disabled={isDeleted}
              className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Borrado forzado antes de 7 dias"
            >
              <Trash2 size={16} />
              Eliminacion forzada
            </button>

            <button
              type="button"
              onClick={() => setIsFeatured((v) => !v)}
              disabled={isDeleted}
              className="inline-flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm font-bold text-yellow-800 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Fija este replay en el muro"
            >
              <Star size={16} />
              {isFeatured ? "Quitar destacado" : "Destacar"}
            </button>
          </div>

          <div className="mt-5">
            {isDeleted ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
                Este replay fue marcado como eliminado permanentemente.
              </div>
            ) : (
              <ReplayMatchBlock videoSrc={videoSrc} poster={poster} clockLabel={`${result.time}:00`} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}