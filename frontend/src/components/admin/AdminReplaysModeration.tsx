import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Eye, EyeOff, Plus, Save, Star, Trash2 } from "lucide-react";
import ReplayMatchBlock from "@/components/replays/ReplayMatchBlock";
import {
  loadReplayCourts,
  saveReplayCourts,
} from "@/utils/replay-courts-api";
import {
  loadReplayShiftConfig,
  saveReplayShiftConfig,
} from "@/utils/replay-shift-config-api";
import { buildLastSevenDaysOptions } from "@/utils/replay-date-options";
import {
  buildReplayShiftTurnosFromConfig,
  getDefaultReplayShiftConfigFromEnv,
  type ReplayShiftConfig,
} from "@/utils/replay-shift-turnos";

type Option = { value: string; label: string };

type MatchResult = {
  court: string;
  date: string;
  time: string;
  timeRangeLabel: string;
};

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

const apiBase = import.meta.env.PUBLIC_REPLAY_API_BASE ?? "";

export default function AdminReplaysModeration() {
  const dates = useMemo(buildLastSevenDaysOptions, []);
  const [courtRows, setCourtRows] = useState<{ slug: string; label: string }[]>([
    { slug: "cancha-padel", label: "Cancha Padel" },
    { slug: "cancha-f5", label: "Cancha F5" },
  ]);
  const courtOptions = useMemo(
    () => courtRows.map((r) => ({ value: r.slug, label: r.label })),
    [courtRows],
  );

  const [shiftConfig, setShiftConfig] = useState<ReplayShiftConfig>(() =>
    getDefaultReplayShiftConfigFromEnv(),
  );
  const turnos = useMemo(() => buildReplayShiftTurnosFromConfig(shiftConfig), [shiftConfig]);

  const [formDurMin, setFormDurMin] = useState(() =>
    Math.round(getDefaultReplayShiftConfigFromEnv().shiftDurationSeconds / 60),
  );
  const [formStart, setFormStart] = useState(
    () => getDefaultReplayShiftConfigFromEnv().windowStartHour,
  );
  const [formEnd, setFormEnd] = useState(() => getDefaultReplayShiftConfigFromEnv().windowEndHour);
  const [adminSecret, setAdminSecret] = useState("");
  const [shiftSaveMsg, setShiftSaveMsg] = useState<string | null>(null);
  const [shiftSaving, setShiftSaving] = useState(false);
  const [courtsSaveMsg, setCourtsSaveMsg] = useState<string | null>(null);
  const [courtsSaving, setCourtsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadReplayCourts(apiBase).then((p) => {
      if (cancelled) return;
      setCourtRows(p.courts.map((c) => ({ slug: c.slug, label: c.label })));
    });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    let cancelled = false;
    void loadReplayShiftConfig(apiBase).then((c) => {
      if (cancelled) return;
      setShiftConfig(c);
      setFormDurMin(Math.max(5, Math.round(c.shiftDurationSeconds / 60)));
      setFormStart(c.windowStartHour);
      setFormEnd(c.windowEndHour);
    });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const [court, setCourt] = useState("");
  const [date, setDate] = useState(() => buildLastSevenDaysOptions()[0]?.value ?? "");
  const [time, setTime] = useState("");
  const [openMenu, setOpenMenu] = useState<"court" | "date" | "time" | null>(null);

  const [result, setResult] = useState<MatchResult | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    if (court && courtRows.length > 0 && !courtRows.some((r) => r.slug === court)) {
      setCourt("");
    }
  }, [courtRows, court]);

  useEffect(() => {
    if (!time) return;
    if (!turnos.some((t) => t.value === time)) {
      setTime("");
    }
  }, [turnos, time]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!court || !date || !time) {
      window.alert("Selecciona cancha, fecha y horario para buscar el bloque.");
      return;
    }
    const courtLabel = courtRows.find((c) => c.slug === court)?.label ?? court;
    const dateLabel = dates.find((d) => d.value === date)?.label ?? date;
    const timeRangeLabel = turnos.find((t) => t.value === time)?.label ?? time;

    setResult({
      court: courtLabel,
      date: dateLabel,
      time,
      timeRangeLabel,
    });
    setIsPublic(true);
    setIsDeleted(false);
    setIsFeatured(false);
    setOpenMenu(null);
  };

  const onSaveCourts = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourtsSaveMsg(null);
    if (!apiBase.trim()) {
      setCourtsSaveMsg("Configurá PUBLIC_REPLAY_API_BASE.");
      return;
    }
    if (!adminSecret.trim()) {
      setCourtsSaveMsg("Falta ADMIN_SECRET.");
      return;
    }
    const cleaned = courtRows
      .map((r) => ({ slug: r.slug.trim(), label: r.label.trim() }))
      .filter((r) => r.slug !== "" && r.label !== "");
    if (cleaned.length === 0) {
      setCourtsSaveMsg("Al menos una cancha con slug y nombre.");
      return;
    }
    setCourtsSaving(true);
    try {
      const payload = await saveReplayCourts(
        apiBase,
        adminSecret,
        cleaned.map((r, i) => ({ ...r, sortOrder: i })),
      );
      setCourtRows(payload.courts.map((c) => ({ slug: c.slug, label: c.label })));
      setCourtsSaveMsg(
        payload.source === "database"
          ? "Canchas guardadas en la base."
          : "Guardado con fallback de entorno.",
      );
    } catch (err) {
      setCourtsSaveMsg(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setCourtsSaving(false);
    }
  };

  const onSaveShiftConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setShiftSaveMsg(null);
    if (!apiBase.trim()) {
      setShiftSaveMsg("Configurá PUBLIC_REPLAY_API_BASE para guardar en la base.");
      return;
    }
    if (!adminSecret.trim()) {
      setShiftSaveMsg("Falta ADMIN_SECRET (header x-admin-secret).");
      return;
    }
    const sec = formDurMin * 60;
    if (sec < 300 || sec > 28_800) {
      setShiftSaveMsg("Duración: entre 5 y 480 minutos.");
      return;
    }
    setShiftSaving(true);
    try {
      const saved = await saveReplayShiftConfig(apiBase, adminSecret, {
        shiftDurationSeconds: sec,
        windowStartHour: formStart,
        windowEndHour: formEnd,
      });
      setShiftConfig(saved);
      setFormDurMin(Math.max(5, Math.round(saved.shiftDurationSeconds / 60)));
      setFormStart(saved.windowStartHour);
      setFormEnd(saved.windowEndHour);
      setShiftSaveMsg(
        saved.source === "database"
          ? "Guardado en la base. La vista pública usa estos turnos (tras recargar)."
          : "Guardado; el servidor sigue en fallback de entorno.",
      );
    } catch (err) {
      setShiftSaveMsg(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setShiftSaving(false);
    }
  };

  return (
    <div>
      <section className="py-1">
        <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Replays</h2>
        <p className="mt-2 max-w-3xl text-base text-slate-700">
          Buscador igual a la vista publica con herramientas de moderacion para recepcion.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Canchas</h3>
        <p className="mt-1 text-sm text-slate-600">
          El <span className="font-semibold">slug</span> se usa en el enlace interno del replay (minúsculas y guiones); el{" "}
          <span className="font-semibold">nombre</span> es lo que ve el público.
        </p>
        <form onSubmit={onSaveCourts} className="mt-4 space-y-3">
          {courtRows.map((row, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2">
              <label className="block min-w-[140px] flex-1 text-xs font-bold uppercase tracking-wider text-slate-600">
                Slug
                <input
                  type="text"
                  value={row.slug}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCourtRows((prev) => prev.map((r, i) => (i === idx ? { ...r, slug: v } : r)));
                  }}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-2 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
                  spellCheck={false}
                  autoCapitalize="off"
                />
              </label>
              <label className="block min-w-[160px] flex-[2] text-xs font-bold uppercase tracking-wider text-slate-600">
                Nombre visible
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCourtRows((prev) => prev.map((r, i) => (i === idx ? { ...r, label: v } : r)));
                  }}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-2 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
                />
              </label>
              <button
                type="button"
                disabled={courtRows.length <= 1}
                onClick={() => setCourtRows((prev) => prev.filter((_, i) => i !== idx))}
                className="inline-flex h-10 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={14} />
                Quitar
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                setCourtRows((prev) => [...prev, { slug: "", label: "" }])
              }
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <Plus size={16} />
              Agregar cancha
            </button>
            <button
              type="submit"
              disabled={courtsSaving}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-60"
            >
              <Save size={16} />
              {courtsSaving ? "Guardando…" : "Guardar canchas"}
            </button>
          </div>
        </form>
        {courtsSaveMsg && (
          <p className="mt-3 text-sm font-semibold text-slate-700">{courtsSaveMsg}</p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
          Turnos (base de datos)
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Valores por defecto en entorno si la tabla no existe o falla Supabase. Fuente actual:{" "}
          <span className="font-bold text-slate-800">
            {shiftConfig.source === "database" ? "Base de datos" : "Variables de entorno"}
          </span>
          .
        </p>
        <form onSubmit={onSaveShiftConfig} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Duración turno (min)
            <input
              type="number"
              min={5}
              max={480}
              step={1}
              value={formDurMin}
              onChange={(e) => setFormDurMin(Number(e.target.value))}
              className="mt-1.5 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Inicio grabación (hora 0–23)
            <input
              type="number"
              min={0}
              max={23}
              value={formStart}
              onChange={(e) => setFormStart(Number(e.target.value))}
              className="mt-1.5 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Fin grabación (hora 1–24, 24 = medianoche)
            <input
              type="number"
              min={1}
              max={24}
              value={formEnd}
              onChange={(e) => setFormEnd(Number(e.target.value))}
              className="mt-1.5 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 sm:col-span-2 lg:col-span-1">
            Admin secret
            <input
              type="password"
              autoComplete="off"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="ADMIN_SECRET del API"
              className="mt-1.5 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={shiftSaving}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Save size={16} />
              {shiftSaving ? "Guardando…" : "Guardar turnos en la base"}
            </button>
          </div>
        </form>
        {shiftSaveMsg && (
          <p className="mt-3 text-sm font-semibold text-slate-700">{shiftSaveMsg}</p>
        )}
      </section>

      <section className="mt-6">
        <form onSubmit={onSearch} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <DropdownField
            id="admin-court"
            label="Cancha"
            placeholder="Selecciona cancha"
            options={courtOptions}
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
            label="Día (últimos 7)"
            placeholder="Selecciona día"
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
            label="Turno (inicio · fin grabación)"
            placeholder="Selecciona turno"
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
                {result.date} | Grabación {result.timeRangeLabel}
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
              <ReplayMatchBlock videoSrc={videoSrc} poster={poster} clockLabel={result.timeRangeLabel} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}