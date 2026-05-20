import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDot,
  Loader2,
  TriangleAlert,
  Video,
} from "lucide-react";
import {
  fetchRecorderStatus,
  type RecorderHeartbeatRow,
} from "@/utils/recorder-admin-api";

const REFRESH_MS = 15_000;

export default function AdminRecorderStatusWidget() {
  const [adminSecret, setAdminSecret] = useState<string>(() => {
    const fromEnv = import.meta.env.PUBLIC_REPLAY_ADMIN_SECRET ?? "";
    if (fromEnv) return String(fromEnv);
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("vj_admin_secret") ?? "";
  });
  const [rows, setRows] = useState<RecorderHeartbeatRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    if (!adminSecret) {
      setError(null);
      setRows([]);
      setInitialLoading(false);
      return;
    }
    try {
      const data = await fetchRecorderStatus(adminSecret);
      setRows(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInitialLoading(false);
    }
  }, [adminSecret]);

  useEffect(() => {
    void load();
    if (!adminSecret) return;
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [adminSecret, load]);

  const summary = useMemo(() => {
    const counts = { recording: 0, error: 0, idle: 0, paused: 0, other: 0 };
    for (const r of rows) {
      if (r.status === "recording" && !r.stale) counts.recording += 1;
      else if (r.status === "error" || (r.status === "recording" && r.stale)) counts.error += 1;
      else if (r.status === "idle") counts.idle += 1;
      else if (r.status === "paused") counts.paused += 1;
      else counts.other += 1;
    }
    return counts;
  }, [rows]);

  function persistAdminSecret(v: string): void {
    setAdminSecret(v);
    if (typeof window !== "undefined") {
      if (v) window.localStorage.setItem("vj_admin_secret", v);
      else window.localStorage.removeItem("vj_admin_secret");
    }
  }

  if (!adminSecret) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Pegá admin secret para ver el estado
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Queda guardado en este navegador.
            </p>
          </div>
        </div>
        <input
          type="password"
          className="mt-2 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
          placeholder="admin secret"
          onBlur={(e) => persistAdminSecret(e.target.value.trim())}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Video size={16} className="text-slate-500" />
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
            Estado del recorder
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
          <SummaryDot tone="ok" count={summary.recording} title="Grabando" />
          <SummaryDot tone="error" count={summary.error} title="Con error" />
          <SummaryDot tone="idle" count={summary.idle} title="Fuera de horario" />
          <SummaryDot tone="paused" count={summary.paused} title="Pausadas" />
        </div>
      </header>

      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {initialLoading && rows.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" /> Cargando estado…
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-500">
          No hay canchas cargadas todavía. Andá a "Grabación" para configurarlas.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li
              key={r.courtSlug}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {r.courtLabel ?? r.courtSlug}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {r.lastSeenAt
                    ? `último ping hace ${r.secondsSinceLastSeen ?? 0}s`
                    : "sin reportar nunca"}
                </p>
              </div>
              <StatusBadge row={r} />
            </li>
          ))}
        </ul>
      )}

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
        Actualizado cada {REFRESH_MS / 1000}s · Configurar en{" "}
        <a href="/admin/grabacion" className="font-bold text-vj-green hover:underline">
          Grabación
        </a>
      </footer>
    </div>
  );
}

function SummaryDot({
  tone,
  count,
  title,
}: {
  tone: "ok" | "error" | "idle" | "paused";
  count: number;
  title: string;
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "error"
        ? "bg-rose-100 text-rose-700"
        : tone === "idle"
          ? "bg-sky-100 text-sky-700"
          : "bg-slate-200 text-slate-600";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {count}
    </span>
  );
}

function StatusBadge({ row }: { row: RecorderHeartbeatRow }) {
  let cls = "bg-slate-100 text-slate-600 ring-slate-200";
  let label: string = row.status;
  let Icon = CircleDot;
  if (row.status === "recording") {
    cls = row.stale
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-emerald-50 text-emerald-700 ring-emerald-200";
    label = row.stale ? "stale" : "rec";
    Icon = row.stale ? TriangleAlert : CheckCircle2;
  } else if (row.status === "error") {
    cls = "bg-rose-50 text-rose-700 ring-rose-200";
    label = "error";
    Icon = TriangleAlert;
  } else if (row.status === "idle") {
    cls = "bg-sky-50 text-sky-700 ring-sky-200";
    label = "idle";
  } else if (row.status === "paused") {
    cls = "bg-slate-100 text-slate-600 ring-slate-200";
    label = "off";
  } else if (row.status === "starting") {
    cls = "bg-indigo-50 text-indigo-700 ring-indigo-200";
    label = "start";
    Icon = Loader2;
  } else if (row.status === "unknown") {
    cls = "bg-amber-50 text-amber-700 ring-amber-200";
    label = "?";
    Icon = TriangleAlert;
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${cls}`}
    >
      <Icon size={10} className={row.status === "starting" ? "animate-spin" : ""} />
      {label}
    </span>
  );
}
