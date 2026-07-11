import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDot,
  Loader2,
  RefreshCw,
  Save,
  ServerCog,
  TriangleAlert,
  Video,
} from "lucide-react";
import {
  fetchCourtsDvr,
  fetchRecorderStatus,
  patchCourtDvr,
  probeCourtDvr,
  type CourtRtspProbeResult,
  type RecorderHeartbeatRow,
  type ManualRecordingRequest,
  triggerManualRecord,
  getManualRecordStatus,
} from "@/utils/recorder-admin-api";
import { Play } from "lucide-react";

interface RowDraft {
  slug: string;
  label: string;
  recordingEnabled: boolean;
  dvrChannel: string; // string en UI; se castea al guardar
  dvrSubtype: number;
  rtspUrlOverride: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  ok: boolean;
}

const STATUS_REFRESH_MS = 15_000;

type CameraProbeUi =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; result: CourtRtspProbeResult }
  | { state: "error"; message: string };

function rowFromServer(c: CourtDvrRow): RowDraft {
  return {
    slug: c.slug,
    label: c.label,
    recordingEnabled: c.recordingEnabled,
    dvrChannel: c.dvrChannel === null ? "" : String(c.dvrChannel),
    dvrSubtype: c.dvrSubtype ?? 0,
    rtspUrlOverride: c.rtspUrlOverride ?? "",
    dirty: false,
    saving: false,
    error: null,
    ok: false,
  };
}

export default function AdminRecorderConfig() {
  const [adminSecret, setAdminSecret] = useState<string>(() => {
    const fromEnv = import.meta.env.PUBLIC_REPLAY_ADMIN_SECRET ?? "";
    if (fromEnv) return String(fromEnv);
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("vj_admin_secret") ?? "";
  });
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowDraft[]>([]);
  const [statuses, setStatuses] = useState<RecorderHeartbeatRow[]>([]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoadingFirst, setStatusLoadingFirst] = useState(true);
  const [cameraProbeBySlug, setCameraProbeBySlug] = useState<Record<string, CameraProbeUi>>(
    {},
  );

  const statusBySlug = useMemo(() => {
    const m = new Map<string, RecorderHeartbeatRow>();
    for (const s of statuses) m.set(s.courtSlug, s);
    return m;
  }, [statuses]);

  const loadData = useCallback(async (): Promise<void> => {
    if (!adminSecret) {
      setRows([]);
      setStatuses([]);
      setGlobalError(null);
      return;
    }
    setLoading(true);
    setGlobalError(null);
    try {
      const [courts, status] = await Promise.all([
        fetchCourtsDvr(adminSecret),
        fetchRecorderStatus(adminSecret).catch((err: unknown) => {
          setStatusError(String(err));
          return [] as RecorderHeartbeatRow[];
        }),
      ]);
      setRows(courts.map(rowFromServer));
      setStatuses(status);
      setStatusError(null);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setStatusLoadingFirst(false);
    }
  }, [adminSecret]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Poll de status cada N segundos
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (!adminSecret) return;
    const tick = async () => {
      try {
        const status = await fetchRecorderStatus(adminSecret);
        setStatuses(status);
        setStatusError(null);
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : String(err));
      }
    };
    pollRef.current = window.setInterval(tick, STATUS_REFRESH_MS) as unknown as number;
    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [adminSecret]);

  function patchRow(slug: string, patch: Partial<RowDraft>): void {
    setRows((prev) =>
      prev.map((r) =>
        r.slug === slug ? { ...r, ...patch, dirty: true, ok: false, error: null } : r,
      ),
    );
  }

  async function saveRow(slug: string): Promise<void> {
    const row = rows.find((r) => r.slug === slug);
    if (!row) return;

    const channelStr = row.dvrChannel.trim();
    let channel: number | null = null;
    if (channelStr !== "") {
      const n = Number(channelStr);
      if (!Number.isInteger(n) || n < 1 || n > 64) {
        setRows((prev) =>
          prev.map((r) =>
            r.slug === slug ? { ...r, error: "Canal debe ser entero 1..64" } : r,
          ),
        );
        return;
      }
      channel = n;
    }
    const rtsp = row.rtspUrlOverride.trim();
    if (rtsp !== "" && !/^rtsp:\/\//i.test(rtsp)) {
      setRows((prev) =>
        prev.map((r) =>
          r.slug === slug
            ? { ...r, error: "RTSP override debe empezar con rtsp://" }
            : r,
        ),
      );
      return;
    }

    setRows((prev) =>
      prev.map((r) => (r.slug === slug ? { ...r, saving: true, error: null } : r)),
    );
    try {
      const updated = await patchCourtDvr(adminSecret, slug, {
        dvrChannel: channel,
        dvrSubtype: row.dvrSubtype,
        rtspUrlOverride: rtsp === "" ? null : rtsp,
        recordingEnabled: row.recordingEnabled,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.slug === slug
            ? { ...rowFromServer(updated), ok: true }
            : r,
        ),
      );
      window.setTimeout(() => {
        setRows((prev) =>
          prev.map((r) => (r.slug === slug ? { ...r, ok: false } : r)),
        );
      }, 2000);
    } catch (err) {
      setRows((prev) =>
        prev.map((r) =>
          r.slug === slug
            ? {
                ...r,
                saving: false,
                error: err instanceof Error ? err.message : String(err),
              }
            : r,
        ),
      );
    }
  }

  async function probeCamera(slug: string): Promise<void> {
    setCameraProbeBySlug((prev) => ({ ...prev, [slug]: { state: "loading" } }));
    try {
      const result = await probeCourtDvr(adminSecret, slug);
      if (result.ok) {
        setCameraProbeBySlug((prev) => ({ ...prev, [slug]: { state: "ok", result } }));
      } else {
        setCameraProbeBySlug((prev) => ({
          ...prev,
          [slug]: { state: "error", message: result.error ?? "Sin video" },
        }));
      }
    } catch (err) {
      setCameraProbeBySlug((prev) => ({
        ...prev,
        [slug]: {
          state: "error",
          message: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  }

  function persistAdminSecret(v: string): void {
    setAdminSecret(v);
    if (typeof window !== "undefined") {
      if (v) window.localStorage.setItem("vj_admin_secret", v);
      else window.localStorage.removeItem("vj_admin_secret");
    }
  }

  if (!adminSecret) {
    return (
      <div className="border border-amber-300 bg-amber-50 p-5">
        <h3 className="text-sm font-black uppercase tracking-wider text-amber-800">
          Falta admin secret
        </h3>
        <p className="mt-1 text-sm text-amber-800">
          Pegá el valor de <code>PUBLIC_REPLAY_ADMIN_SECRET</code> para usar este panel.
          Queda guardado en este navegador.
        </p>
        <input
          type="password"
          className="mt-3 w-full border border-amber-300 bg-white px-3 py-2 text-sm"
          placeholder="admin secret"
          onBlur={(e) => persistAdminSecret(e.target.value.trim())}
        />
      </div>
    );
  }

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Grabación de canchas
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-700">
            Configurá el canal del DVR Dahua de cada cancha. Usá{" "}
            <strong>Probar cámara</strong> para verificar RTSP en vivo; la columna{" "}
            <strong>Recorder</strong> muestra si el proceso de grabación está corriendo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refrescar
          </button>
        </div>
      </header>

      {globalError && (
        <div className="mt-4 border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {globalError}
        </div>
      )}

      <section className="mt-6 overflow-x-auto border border-slate-300 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-slate-500">Cancha</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-slate-500">Cámara RTSP</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-slate-500">Recorder</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-slate-500">Canal DVR</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-slate-500">Subtype</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-slate-500">RTSP override</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-slate-500">Grabando</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-slate-500">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                  No hay canchas cargadas. Creálas en "Configuración" primero.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const status = statusBySlug.get(row.slug);
              const cameraProbe = cameraProbeBySlug[row.slug] ?? { state: "idle" };
              return (
                <tr key={row.slug} className="border-t border-slate-200 align-top">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{row.label}</p>
                    <p className="text-xs text-slate-500">{row.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <CameraProbeCell
                      probe={cameraProbe}
                      onProbe={() => void probeCamera(row.slug)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge row={status} loading={statusLoadingFirst} />
                    {status?.errorMessage && (
                      <p className="mt-1 max-w-xs text-[11px] text-rose-700">
                        {status.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      max={64}
                      inputMode="numeric"
                      value={row.dvrChannel}
                      onChange={(e) => patchRow(row.slug, { dvrChannel: e.target.value })}
                      placeholder="—"
                      className="w-24 border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.dvrSubtype}
                      onChange={(e) =>
                        patchRow(row.slug, { dvrSubtype: Number(e.target.value) })
                      }
                      className="border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value={0}>0 — main</option>
                      <option value={1}>1 — sub</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.rtspUrlOverride}
                      onChange={(e) =>
                        patchRow(row.slug, { rtspUrlOverride: e.target.value })
                      }
                      placeholder="rtsp://… (opcional, anula canal)"
                      className="w-72 border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.recordingEnabled}
                        onChange={(e) =>
                          patchRow(row.slug, { recordingEnabled: e.target.checked })
                        }
                        className="h-4 w-4 border-slate-300 text-vj-green focus:ring-vj-green"
                      />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        {row.recordingEnabled ? "Sí" : "No"}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <button
                        type="button"
                        disabled={!row.dirty || row.saving}
                        onClick={() => void saveRow(row.slug)}
                        className="inline-flex items-center gap-1.5 bg-vj-green px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-vj-green/90 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                      >
                        {row.saving ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Save size={13} />
                        )}
                        Guardar
                      </button>
                      {row.ok && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 size={12} /> Guardado
                        </span>
                      )}
                      {row.error && (
                        <span className="max-w-[180px] text-[11px] font-semibold text-rose-700">
                          {row.error}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2 px-1 pb-3">
          <ServerCog size={16} className="text-slate-500" />
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
            Estado del recorder (en vivo)
          </h3>
        </div>
        {statusError && (
          <div className="mb-3 border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800">
            {statusError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statuses.map((s) => (
            <article
              key={s.courtSlug}
              className="border border-slate-300 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {s.courtLabel ?? s.courtSlug}
                  </p>
                  <p className="text-xs text-slate-500">{s.courtSlug}</p>
                </div>
                <StatusBadge row={s} />
              </div>
              <dl className="mt-3 space-y-1 text-xs text-slate-600">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Último ping</dt>
                  <dd className="font-semibold text-slate-700">
                    {s.lastSeenAt ? `hace ${s.secondsSinceLastSeen ?? 0}s` : "nunca"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Último segmento</dt>
                  <dd className="truncate font-semibold text-slate-700">
                    {s.lastSegmentMatchKey ?? "—"}
                  </dd>
                </div>
                {s.errorMessage && (
                  <div className="bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700">
                    {s.errorMessage}
                  </div>
                )}
              </dl>
            </article>
          ))}
        </div>
      </section>

      {rows.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-2 px-1 pb-3">
            <Video size={16} className="text-slate-500" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
              Turnos de Prueba Manuales
            </h3>
          </div>
          <div className="border border-slate-300 bg-white p-4 shadow-sm">
            <p className="mb-4 text-sm text-slate-600">
              Generá una grabación de 1 minuto bajo demanda para cualquier cancha. El recorder
              recibirá la orden, grabará el clip, lo subirá a la nube y te devolverá el código.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.filter(r => r.recordingEnabled).map(row => (
                <ManualRecordingCard key={row.slug} row={row} adminSecret={adminSecret} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ManualRecordingCard({ row, adminSecret }: { row: RowDraft, adminSecret: string }) {
  const [request, setRequest] = useState<ManualRecordingRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRecord = async () => {
    setLoading(true);
    setError(null);
    try {
      const req = await triggerManualRecord(adminSecret, row.slug, 60);
      setRequest(req);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!request) return;
    if (request.status === 'completed' || request.status === 'error') return;

    const interval = setInterval(async () => {
      try {
        const updated = await getManualRecordStatus(adminSecret, request.id);
        setRequest(updated);
      } catch (err) {
        console.error("Error polling manual record status", err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [request, adminSecret]);

  return (
    <div className="border border-slate-200 bg-slate-50 p-3 flex flex-col gap-3 rounded">
      <div>
        <p className="font-bold text-sm text-slate-800">{row.label}</p>
        <p className="text-xs text-slate-500">{row.slug}</p>
      </div>
      
      {!request ? (
        <button
          onClick={startRecord}
          disabled={loading}
          className="inline-flex justify-center items-center gap-1.5 bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          Grabar Prueba (1 min)
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-slate-600 flex items-center gap-1">
            Estado: 
            <span className="uppercase tracking-wider text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
              {request.status}
            </span>
          </div>
          
          {request.status === 'completed' && request.plain_code && (
            <div className="mt-1 border border-emerald-200 bg-emerald-50 p-2 rounded">
              <p className="text-xs text-emerald-800 mb-1">¡Grabación exitosa!</p>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-lg text-emerald-900">{request.plain_code}</span>
              </div>
            </div>
          )}
          
          {request.status === 'error' && (
            <div className="mt-1 border border-rose-200 bg-rose-50 p-2 rounded text-xs text-rose-700">
              {request.error_message || 'Error desconocido'}
            </div>
          )}

          {(request.status === 'completed' || request.status === 'error') && (
            <button
              onClick={() => setRequest(null)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 text-left underline mt-1"
            >
              Nueva prueba
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
    </div>
  );
}

function CameraProbeCell({
  probe,
  onProbe,
}: {
  probe: CameraProbeUi;
  onProbe: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onProbe}
        disabled={probe.state === "loading"}
        className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {probe.state === "loading" ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Video size={12} />
        )}
        Probar cámara
      </button>
      {probe.state === "idle" && (
        <span className="text-[11px] text-slate-500">Sin probar aún</span>
      )}
      {probe.state === "ok" && probe.result.video && (
        <span className="inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
          <CheckCircle2 size={11} />
          Conectada · {probe.result.video.width}×{probe.result.video.height}
        </span>
      )}
      {probe.state === "error" && (
        <span className="max-w-[200px] text-[11px] font-semibold text-rose-700">
          {probe.message}
        </span>
      )}
    </div>
  );
}

function StatusBadge({
  row,
  loading,
}: {
  row: RecorderHeartbeatRow | undefined;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 ring-1 ring-slate-200">
        <Loader2 size={11} className="animate-spin" /> ...
      </span>
    );
  }
  if (!row) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 ring-1 ring-slate-200">
        <CircleDot size={11} /> Sin datos
      </span>
    );
  }
  let cls = "bg-slate-100 text-slate-600 ring-slate-200";
  let label: string = row.status;
  let Icon = CircleDot;
  if (row.status === "recording") {
    cls = row.stale
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-emerald-50 text-emerald-700 ring-emerald-200";
    label = row.stale ? "recording (stale)" : "recording";
    Icon = row.stale ? TriangleAlert : CheckCircle2;
  } else if (row.status === "error") {
    cls = "bg-rose-50 text-rose-700 ring-rose-200";
    label = "error";
    Icon = TriangleAlert;
  } else if (row.status === "idle") {
    cls = "bg-sky-50 text-sky-700 ring-sky-200";
    label = "fuera de horario";
  } else if (row.status === "paused") {
    cls = "bg-slate-100 text-slate-600 ring-slate-200";
    label = "deshabilitada";
  } else if (row.status === "starting") {
    cls = "bg-indigo-50 text-indigo-700 ring-indigo-200";
    label = "arrancando";
    Icon = Loader2;
  } else if (row.status === "unknown") {
    cls = "bg-amber-50 text-amber-700 ring-amber-200";
    label = "sin reportar";
    Icon = TriangleAlert;
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${cls}`}
    >
      <Icon size={11} className={row.status === "starting" ? "animate-spin" : ""} />
      {label}
    </span>
  );
}
