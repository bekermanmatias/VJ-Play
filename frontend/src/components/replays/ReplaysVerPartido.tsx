import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import MatchReplayGate from "@/components/replays/MatchReplayGate";
import { getReplayCourtsSnapshot, loadReplayCourts } from "@/utils/replay-courts-api";
import { buildLastSevenDaysOptions } from "@/utils/replay-date-options";
import { loadReplayShiftConfig } from "@/utils/replay-shift-config-api";
import { buildReplayMatchKey } from "@/utils/replay-match-key";
import {
  buildReplayShiftTurnosFromConfig,
  getDefaultReplayShiftConfigFromEnv,
  type ReplayShiftConfig,
} from "@/utils/replay-shift-turnos";
import { getReplayApiBaseFromEnv } from "@/utils/replay-api-base";

const apiBase = getReplayApiBaseFromEnv();
const POSTER_FALLBACK =
  "https://images.unsplash.com/photo-1627615922102-6b7ef5f0ec55?auto=format&fit=crop&w=1400&q=70";

type Option = { value: string; label: string };

type DropdownFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  options: Option[];
  value: string;
  showCalendarIcon?: boolean;
  onPick: (value: string) => void;
};

function DropdownField({
  id,
  label,
  placeholder,
  options,
  value,
  showCalendarIcon = false,
  onPick,
}: DropdownFieldProps) {
  return (
    <div className="relative">
      <span className="mb-1.5 inline-block text-xs font-bold uppercase tracking-wider text-slate-600">
        {label}
      </span>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onPick(e.target.value)}
          className={`h-12 w-full appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-10 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-vj-green ${showCalendarIcon ? "pr-14" : "pr-10"}`}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5">
          {showCalendarIcon && <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden />}
          <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden />
        </span>
      </div>
    </div>
  );
}

export default function ReplaysVerPartido() {
  const [shiftConfig, setShiftConfig] = useState<ReplayShiftConfig>(() =>
    getDefaultReplayShiftConfigFromEnv(),
  );
  const turnos = useMemo(() => buildReplayShiftTurnosFromConfig(shiftConfig), [shiftConfig]);
  const fechas = useMemo(buildLastSevenDaysOptions, []);
  const [courtOptions, setCourtOptions] = useState<Option[]>(() =>
    getReplayCourtsSnapshot(apiBase).courts.map((c) => ({ value: c.slug, label: c.label })),
  );
  const [cancha, setCancha] = useState("");
  const [fecha, setFecha] = useState(() => buildLastSevenDaysOptions()[0]?.value ?? "");
  const [hora, setHora] = useState("");
  const [checkingMatch, setCheckingMatch] = useState(false);
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const [notFoundMsg, setNotFoundMsg] = useState("El turno seleccionado no existe o ya no está disponible.");
  const [accessOpen, setAccessOpen] = useState(false);
  const [selectedNumericId, setSelectedNumericId] = useState<number | null>(null);
  const [clockLabel, setClockLabel] = useState("--:--:--");

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

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cancha || !fecha || !hora) {
      return;
    }
    setCheckingMatch(true);
    try {
      if (!apiBase.trim()) {
        throw new Error("El servicio de replays no está disponible en este momento.");
      }
      const matchKey = `${cancha}|${fecha}|${hora}`;
      const existsUrl = new URL(`${apiBase.replace(/\/$/, "")}/api/replays/access/exists`);
      existsUrl.searchParams.set("matchKey", matchKey);
      const res = await fetch(existsUrl.toString());
      const body = (await res.json().catch(() => null)) as
        | { exists?: boolean; numericId?: number; error?: string }
        | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "No se pudo validar el turno.");
      }
      if (!body?.exists) {
        setNotFoundMsg("El turno seleccionado no existe o ya no está disponible.");
        setNotFoundOpen(true);
        return;
      }
      const numericId = typeof body?.numericId === "number" ? body.numericId : null;
      if (!numericId || numericId <= 0) {
        throw new Error("No se pudo obtener el ID del partido.");
      }
      const turnoOpt = turnos.find((t) => t.value === hora);
      const label =
        turnoOpt?.label ??
        (/^\d{2}:\d{2}$/.test(hora) ? `${hora}:00` : hora || "--:--:--");
      setClockLabel(label);
      setSelectedNumericId(numericId);
      setAccessOpen(true);
    } catch (err) {
      setNotFoundMsg(err instanceof Error ? err.message : "No se pudo validar el turno.");
      setNotFoundOpen(true);
    } finally {
      setCheckingMatch(false);
    }
  };

  useEffect(() => {
    if (!notFoundOpen && !accessOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (accessOpen) setAccessOpen(false);
      if (notFoundOpen) setNotFoundOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      document.removeEventListener("keydown", onKey);
    };
  }, [notFoundOpen, accessOpen]);

  const selectedMatchKey = useMemo(() => {
    if (!cancha || !fecha || !hora) return "";
    return buildReplayMatchKey({ cancha, fecha, hora });
  }, [cancha, fecha, hora]);

  const onCodeAuthorized = ({ sessionToken }: { sessionToken: string }) => {
    if (!selectedNumericId || !selectedMatchKey || !sessionToken) return;
    try {
      sessionStorage.setItem(
        `vj_replay_sess:${selectedMatchKey}`,
        JSON.stringify({ matchKey: selectedMatchKey, token: sessionToken }),
      );
    } catch {
      /* ignore */
    }
    window.location.href = `/replays/${selectedNumericId}?cinema=1`;
  };

  return (
    <>
      <form
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
            onPick={(v) => {
              setCancha(v);
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-1">
          <div className="block">
            <DropdownField
              id="replays-fecha"
              label="Día"
              placeholder="Selecciona día"
              options={fechas}
              value={fecha}
              showCalendarIcon
              onPick={(v) => {
                setFecha(v);
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
              onPick={(v) => {
                setHora(v);
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
            disabled={checkingMatch || !cancha || !fecha || !hora}
            className="h-12 w-full rounded-md bg-vj-green px-4 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-vj-green-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {checkingMatch ? "Cargando..." : "VER PARTIDO"}
          </button>
        </div>
      </form>

      {notFoundOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setNotFoundOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setNotFoundOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-slate-500 transition hover:bg-slate-100"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700">Replay</p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Partido no encontrado</h3>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">{notFoundMsg}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setNotFoundOpen(false)}
                className="inline-flex h-10 items-center rounded-md bg-vj-green px-4 text-sm font-bold uppercase tracking-wider text-white hover:bg-vj-green-600"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {accessOpen && selectedMatchKey && selectedNumericId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ingresar código del partido"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setAccessOpen(false)}
        >
          <div
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <MatchReplayGate
              key={selectedMatchKey}
              matchKey={selectedMatchKey}
              apiBase={apiBase}
              cinema={false}
              authorizeOnly
              onAuthorized={onCodeAuthorized}
              onClose={() => setAccessOpen(false)}
              clockLabel={clockLabel}
              posterFallback={POSTER_FALLBACK}
            />
          </div>
        </div>
      )}

    </>
  );
}