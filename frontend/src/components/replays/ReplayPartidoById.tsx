import { useEffect, useMemo, useState } from "react";
import MatchReplayGate from "@/components/replays/MatchReplayGate";

type Props = {
  apiBase: string;
  cinema?: boolean;
  matchId?: number | null;
};

type MatchLookup = {
  found: boolean;
  numericId: number;
  matchKey: string | null;
  court: string | null;
  date: string | null;
  shift: string | null;
};

const POSTER_FALLBACK =
  "https://images.unsplash.com/photo-1627615922102-6b7ef5f0ec55?auto=format&fit=crop&w=1400&q=70";

function CinemaPlayer({
  matchKey,
  apiBase,
  clockLabel,
}: {
  matchKey: string;
  apiBase: string;
  clockLabel: string;
}) {
  const [check, setCheck] = useState<"checking" | "ok" | "missing">("checking");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`vj_replay_sess:${matchKey}`);
      if (!raw) {
        setCheck("missing");
        return;
      }
      const parsed = JSON.parse(raw) as { matchKey?: string; token?: string };
      if (
        parsed?.matchKey === matchKey &&
        typeof parsed?.token === "string" &&
        parsed.token.length > 0
      ) {
        setCheck("ok");
      } else {
        setCheck("missing");
      }
    } catch {
      setCheck("missing");
    }
  }, [matchKey]);

  useEffect(() => {
    if (check === "missing" && typeof window !== "undefined") {
      window.location.replace("/replays");
    }
  }, [check]);

  if (check !== "ok") {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-black text-sm font-semibold text-white">
        Validando acceso...
      </div>
    );
  }

  return (
    <MatchReplayGate
      matchKey={matchKey}
      apiBase={apiBase}
      cinema
      clockLabel={clockLabel}
      posterFallback={POSTER_FALLBACK}
    />
  );
}

export default function ReplayPartidoById({ apiBase, cinema = false, matchId = null }: Props) {
  const base = useMemo(() => apiBase.trim().replace(/\/$/, ""), [apiBase]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<MatchLookup | null>(null);

  useEffect(() => {
    const id =
      typeof matchId === "number"
        ? matchId
        : Number.parseInt(new URLSearchParams(window.location.search).get("id") ?? "", 10);
    if (!Number.isFinite(id) || id <= 0) {
      setError("ID de partido inválido.");
      setLoading(false);
      return;
    }
    if (!base) {
      setError("Servicio de replays no disponible.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const url = new URL(`${base}/api/replays/access/match-by-id`);
    url.searchParams.set("id", String(id));
    void fetch(url.toString())
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | (MatchLookup & { error?: string })
          | null;
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(body?.error ?? "No se pudo cargar el partido.");
        }
        setLookup(body);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "No se pudo cargar el partido.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [base, matchId]);

  if (loading) {
    if (cinema) {
      return (
        <div className="flex min-h-dvh w-full items-center justify-center bg-black text-sm font-semibold text-white">
          Cargando partido...
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-600">
        Cargando partido...
      </div>
    );
  }

  if (error || !lookup?.found || !lookup.matchKey) {
    if (cinema) {
      return (
        <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-black px-6 text-center text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-300">Replay</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Partido no encontrado</h2>
          <p className="mt-2 max-w-md text-sm text-slate-300">{error ?? "No existe un partido para ese ID."}</p>
          <a
            href="/replays"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-vj-green px-5 text-sm font-black uppercase tracking-wider text-white transition hover:bg-vj-green-600"
          >
            Volver al buscador
          </a>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700">Replay</p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">Partido no encontrado</h2>
        <p className="mt-2 text-sm text-slate-600">{error ?? "No existe un partido para ese ID."}</p>
        <a
          href="/replays"
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-vj-green px-4 text-sm font-black uppercase tracking-wider text-white transition hover:bg-vj-green-600"
        >
          Volver al buscador
        </a>
      </div>
    );
  }

  const canchaLabel = lookup.court ?? "Cancha";
  const fechaDisplay = /^\d{4}-\d{2}-\d{2}$/.test(lookup.date ?? "")
    ? `${(lookup.date ?? "").slice(8, 10)}/${(lookup.date ?? "").slice(5, 7)}/${(lookup.date ?? "").slice(0, 4)}`
    : (lookup.date ?? "-");
  const turnoLabel = lookup.shift ?? "--:--";
  const clockLabel = /^\d{2}:\d{2}$/.test(turnoLabel) ? `${turnoLabel}:00` : turnoLabel;

  if (cinema) {
    return (
      <CinemaPlayer
        matchKey={lookup.matchKey}
        apiBase={base}
        clockLabel={clockLabel}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 pb-4">
        <div>
          <a
            href="/replays"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:bg-slate-50"
          >
            Volver al buscador
          </a>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Replay</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{canchaLabel}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {turnoLabel} - {fechaDisplay} - ID {lookup.numericId}
          </p>
        </div>
      </div>
      <div className="mt-6">
        <MatchReplayGate
          matchKey={lookup.matchKey}
          apiBase={base}
          cinema={false}
          clockLabel={clockLabel}
          posterFallback={POSTER_FALLBACK}
        />
      </div>
    </div>
  );
}
