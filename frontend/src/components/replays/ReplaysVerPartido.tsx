import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import MatchReplayGate from "@/components/replays/MatchReplayGate";
import { loadReplayCourts } from "@/utils/replay-courts-api";
import { buildLastSevenDaysOptions } from "@/utils/replay-date-options";
import { loadReplayShiftConfig } from "@/utils/replay-shift-config-api";
import { buildReplayMatchKey } from "@/utils/replay-match-key";
import {
  buildReplayShiftTurnosFromConfig,
  getDefaultReplayShiftConfigFromEnv,
  type ReplayShiftConfig,
} from "@/utils/replay-shift-turnos";

const POSTER_FALLBACK =
  "https://images.unsplash.com/photo-1627615922102-6b7ef5f0ec55?auto=format&fit=crop&w=1400&q=70";

const apiBase = import.meta.env.PUBLIC_REPLAY_API_BASE ?? "";

type Option = { value: string; label: string };

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
  const [shiftConfig, setShiftConfig] = useState<ReplayShiftConfig>(() =>
    getDefaultReplayShiftConfigFromEnv(),
  );
  const turnos = useMemo(() => buildReplayShiftTurnosFromConfig(shiftConfig), [shiftConfig]);
  const fechas = useMemo(buildLastSevenDaysOptions, []);
  const [courtOptions, setCourtOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [clockLabel, setClockLabel] = useState("--:--:--");
  const [cancha, setCancha] = useState("");
  const [fecha, setFecha] = useState(() => buildLastSevenDaysOptions()[0]?.value ?? "");
  const [hora, setHora] = useState("");
  const [openMenu, setOpenMenu] = useState<"cancha" | "fecha" | "hora" | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    let cancelled = false;
    void loadReplayShiftConfig(apiBase).then((c) => {
      if (!cancelled) setShiftConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    let cancelled = false;
    void loadReplayCourts(apiBase).then((p) => {
      if (cancelled) return;
      setCourtOptions(p.courts.map((c) => ({ value: c.slug, label: c.label })));
    });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    if (cancha && courtOptions.length > 0 && !courtOptions.some((o) => o.value === cancha)) {
      setCancha("");
    }
  }, [courtOptions, cancha]);

  useEffect(() => {
    if (!hora) return;
    if (!turnos.some((t) => t.value === hora)) {
      setHora("")
    }
  }, [turnos, hora]);

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
      window.alert("Completá cancha, fecha y turno para continuar.");
      return;
    }
    const turnoOpt = turnos.find((t) => t.value === hora);
    const label =
      turnoOpt?.label ??
      (/^\d{2}:\d{2}$/.test(hora) ? `${hora}:00` : hora || "--:--:--");
    setClockLabel(label);
    document.dispatchEvent(new CustomEvent("mobile-nav:close"));
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
            options={courtOptions}
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
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Día automático: hoy y los últimos 6 días
            </p>
            <DropdownField
              id="replays-fecha"
              label="Día"
              placeholder="Selecciona día"
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
              label="Turno (inicio · fin grabación)"
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
          aria-label="Acceso al replay"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black"
          style={{
            paddingTop: "var(--mobile-nav-offset, 0px)",
          }}
        >
          <div className="pointer-events-none absolute right-0 top-0 z-60 flex justify-end p-3 sm:p-4">
            <button
              type="button"
              onClick={close}
              className="pointer-events-auto grid size-11 place-items-center rounded-full text-white filter-[drop-shadow(0_2px_8px_rgba(0,0,0,0.85))] transition hover:bg-white/15"
              aria-label="Cerrar"
            >
              <X size={26} strokeWidth={2.5} />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <MatchReplayGate
              key={buildReplayMatchKey({ cancha, fecha, hora })}
              matchKey={buildReplayMatchKey({ cancha, fecha, hora })}
              apiBase={apiBase}
              cinema
              embedCinema
              clockLabel={clockLabel}
              posterFallback={POSTER_FALLBACK}
            />
          </div>
        </div>
      )}
    </>
  );
}