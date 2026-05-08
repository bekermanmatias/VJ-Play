import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  loadReplayCourts,
  saveReplayCourts,
} from "@/utils/replay-courts-api";
import {
  loadReplayShiftConfig,
  saveReplayShiftConfig,
} from "@/utils/replay-shift-config-api";
import { getReplayAdminSecret } from "@/utils/replay-admin-secret";
import {
  buildReplayShiftTurnosFromConfig,
  getDefaultReplayShiftConfigFromEnv,
  type ReplayShiftConfig,
} from "@/utils/replay-shift-turnos";
import {
  loadReplayAdminMatches,
  type ReplayAdminMatchRow,
} from "@/utils/replay-admin-matches-api";
import { buildLastSevenDaysOptions } from "@/utils/replay-date-options";

const apiBase = import.meta.env.PUBLIC_REPLAY_API_BASE ?? "";

type Props = {
  showSettings?: boolean;
  showMatches?: boolean;
};

export default function AdminReplaysModeration({
  showSettings = true,
  showMatches = true,
}: Props) {
  const [courtRows, setCourtRows] = useState<{ slug: string; label: string }[]>([
    { slug: "cancha-padel", label: "Cancha Padel" },
    { slug: "cancha-f5", label: "Cancha F5" },
  ]);

  const [shiftConfig, setShiftConfig] = useState<ReplayShiftConfig>(() =>
    getDefaultReplayShiftConfigFromEnv(),
  );

  const [formDurMin, setFormDurMin] = useState(() =>
    Math.round(getDefaultReplayShiftConfigFromEnv().shiftDurationSeconds / 60),
  );
  const [formStart, setFormStart] = useState(
    () => getDefaultReplayShiftConfigFromEnv().windowStartHour,
  );
  const [formEnd, setFormEnd] = useState(() => getDefaultReplayShiftConfigFromEnv().windowEndHour);
  const [shiftSaveMsg, setShiftSaveMsg] = useState<string | null>(null);
  const [shiftSaving, setShiftSaving] = useState(false);
  const [courtsSaveMsg, setCourtsSaveMsg] = useState<string | null>(null);
  const [courtsSaving, setCourtsSaving] = useState(false);

  useEffect(() => {
    if (!showSettings && !showMatches) return;
    let cancelled = false;
    void loadReplayCourts(apiBase).then((p) => {
      if (cancelled) return;
      setCourtRows(p.courts.map((c) => ({ slug: c.slug, label: c.label })));
    });
    return () => {
      cancelled = true;
    };
  }, [apiBase, showMatches, showSettings]);

  useEffect(() => {
    if (!showSettings && !showMatches) return;
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
  }, [apiBase, showMatches, showSettings]);

  const [search, setSearch] = useState("");
  const [filterCourt, setFilterCourt] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [rows, setRows] = useState<ReplayAdminMatchRow[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesMsg, setMatchesMsg] = useState<string | null>(null);
  const [copiedMatchKey, setCopiedMatchKey] = useState<string | null>(null);

  const secret = useMemo(() => getReplayAdminSecret(), []);
  const shiftOptions = useMemo(() => buildReplayShiftTurnosFromConfig(shiftConfig), [shiftConfig]);
  const dateOptions = useMemo(buildLastSevenDaysOptions, []);

  const loadMatches = async (query: string) => {
    if (!apiBase.trim()) {
      setMatchesMsg("Configurá PUBLIC_REPLAY_API_BASE.");
      setRows([]);
      return;
    }
    if (!secret) {
      setMatchesMsg("Definí PUBLIC_REPLAY_ADMIN_SECRET en frontend/.env.");
      setRows([]);
      return;
    }
    setMatchesLoading(true);
    setMatchesMsg(null);
    try {
      const payload = await loadReplayAdminMatches({
        apiBase,
        adminSecret: secret,
        query,
      });
      setRows(payload);
      if (payload.length === 0) {
        setMatchesMsg(null);
      }
    } catch (err) {
      setMatchesMsg(err instanceof Error ? err.message : "No se pudo cargar partidos.");
      setRows([]);
    } finally {
      setMatchesLoading(false);
    }
  };

  const onSearchMatches = (e: React.FormEvent) => {
    e.preventDefault();
    const hasFreeSearch = search.trim().length > 0;
    if (!hasFreeSearch && !filterShift.trim()) {
      setMatchesMsg("Seleccioná un turno para buscar.");
      setRows([]);
      return;
    }
    const query = [search, filterCourt, filterDate, filterShift]
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .join(" ");
    void loadMatches(query);
  };

  const onCopyCode = async (row: ReplayAdminMatchRow) => {
    if (!row.code) return;
    try {
      await navigator.clipboard.writeText(row.code);
      setCopiedMatchKey(row.matchKey);
      window.setTimeout(() => setCopiedMatchKey((prev) => (prev === row.matchKey ? null : prev)), 1200);
    } catch {
      setMatchesMsg("No se pudo copiar al portapapeles.");
    }
  };

  const onSaveCourts = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourtsSaveMsg(null);
    if (!apiBase.trim()) {
      setCourtsSaveMsg("Configurá PUBLIC_REPLAY_API_BASE.");
      return;
    }
    const secret = getReplayAdminSecret();
    if (!secret) {
      setCourtsSaveMsg(
        "Definí PUBLIC_REPLAY_ADMIN_SECRET en el .env del frontend (mismo valor que ADMIN_SECRET del API).",
      );
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
        secret,
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
    const secret = getReplayAdminSecret();
    if (!secret) {
      setShiftSaveMsg(
        "Definí PUBLIC_REPLAY_ADMIN_SECRET en el .env del frontend (mismo valor que ADMIN_SECRET del API).",
      );
      return;
    }
    const sec = formDurMin * 60;
    if (sec < 300 || sec > 28_800) {
      setShiftSaveMsg("Duración: entre 5 y 480 minutos.");
      return;
    }
    setShiftSaving(true);
    try {
      const saved = await saveReplayShiftConfig(apiBase, secret, {
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
          Gestión operativa: canchas, turnos y códigos de acceso por partido.
        </p>
      </section>

      {showSettings && (
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
              <label className="block min-w-[160px] flex-2 text-xs font-bold uppercase tracking-wider text-slate-600">
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
      )}

      {showSettings && (
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
        <form onSubmit={onSaveShiftConfig} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-3">
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
          <div className="flex items-end sm:col-span-3 lg:col-span-3">
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
      )}

      {showMatches && (
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
            Partidos
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const query = [search, filterCourt, filterDate, filterShift]
                  .map((v) => v.trim())
                  .filter((v) => v.length > 0)
                  .join(" ");
                const hasFreeSearch = search.trim().length > 0;
                if (!hasFreeSearch && !filterShift.trim()) {
                  setMatchesMsg("Seleccioná un turno para buscar.");
                  setRows([]);
                  return;
                }
                void loadMatches(query);
              }}
              disabled={matchesLoading}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {matchesLoading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Buscá tu partido por cancha, fecha y turno. También podés usar el ID del partido.
        </p>

        <form onSubmit={onSearchMatches} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ej: 10452231, cancha-padel, 2026-05-08, 10:00"
            className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
          />
          <button
            type="submit"
            disabled={matchesLoading}
            className="h-11 rounded-md bg-vj-green px-4 text-sm font-bold uppercase tracking-wider text-white hover:bg-vj-green-600 disabled:opacity-50"
          >
            Buscar
          </button>
        </form>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Cancha
            <select
              value={filterCourt}
              onChange={(e) => setFilterCourt(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
            >
              <option value="">Todas</option>
              {courtRows.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Fecha
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
            >
              <option value="">Todas</option>
              {dateOptions.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Turno
            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-vj-green"
            >
              <option value="">Seleccionar turno</option>
              {shiftOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {matchesMsg && matchesMsg !== "No hay partidos que coincidan con la búsqueda." && (
          <p className="mt-3 text-sm font-semibold text-slate-700">{matchesMsg}</p>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full table-fixed border border-slate-200 text-sm">
            <colgroup>
              <col className="w-[110px]" />
              <col className="w-[150px]" />
              <col className="w-[130px]" />
              <col className="w-[110px]" />
              <col className="w-[120px]" />
              <col className="w-[220px]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr className="h-10">
                <th className="border-b border-slate-200 px-3 py-2 text-left">ID</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left">Cancha</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left">Fecha</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left">Turno</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left">Código</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.matchKey} className="h-12 odd:bg-white even:bg-slate-50/40">
                  <td className="border-b border-slate-100 px-3 py-2 align-middle font-mono text-xs">{row.numericId}</td>
                  <td className="border-b border-slate-100 px-3 py-2 align-middle whitespace-nowrap">{row.court || "-"}</td>
                  <td className="border-b border-slate-100 px-3 py-2 align-middle whitespace-nowrap">{row.date || "-"}</td>
                  <td className="border-b border-slate-100 px-3 py-2 align-middle whitespace-nowrap">{row.shift || "-"}</td>
                  <td className="border-b border-slate-100 px-3 py-2 align-middle">
                    <span className="font-mono text-xs font-bold text-slate-800">{row.code ?? "Generando..."}</span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 align-middle">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void onCopyCode(row)}
                        disabled={!row.code}
                        className="h-8 w-24 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-center text-xs font-bold leading-none text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                      >
                        {copiedMatchKey === row.matchKey ? "Copiado" : "Copiar código"}
                      </button>
                      <a
                        href={`/replays/${encodeURIComponent(String(row.numericId))}?cinema=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-24 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-center text-xs font-bold leading-none text-slate-700 hover:bg-slate-50"
                      >
                        Ver partido
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !matchesLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-sm font-semibold text-slate-500">
                    {filterShift.trim()
                      ? "No hay partidos que coincidan con la búsqueda."
                      : "Seleccioná filtros y buscá un turno para ver resultados."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  );
}