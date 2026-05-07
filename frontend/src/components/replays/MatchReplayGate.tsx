import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import MatchPlayerZoom from "@/components/replays/MatchPlayerZoom";
import ReplayMatchBlock from "@/components/replays/ReplayMatchBlock";

type Props = {
  matchKey: string;
  apiBase: string;
  cinema: boolean;
  /** Dentro de un modal fullscreen ya existente (ej. Replays): evita otro `main` fixed a pantalla completa. */
  embedCinema?: boolean;
  clockLabel: string;
  /** Poster por defecto (antes de resolver URL desde API). */
  posterFallback: string;
};

function wrapCinemaEmbed(embed: boolean, node: ReactNode): ReactNode {
  if (!embed) {
    return node;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto p-4">
      {node}
    </div>
  );
}

function storageKeyFor(matchKey: string): string {
  return `vj_replay_sess:${matchKey}`;
}

export default function MatchReplayGate({
  matchKey,
  apiBase,
  cinema,
  embedCinema = false,
  clockLabel,
  posterFallback,
}: Props) {
  const base = useMemo(() => apiBase.trim().replace(/\/$/, ""), [apiBase]);
  const hasApi = base.length > 0;
  const whatsappUrl = import.meta.env.PUBLIC_REPLAY_WHATSAPP_URL?.trim() ?? "";

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const persistSession = useCallback(
    (token: string) => {
      try {
        sessionStorage.setItem(storageKeyFor(matchKey), JSON.stringify({ matchKey, token }));
      } catch {
        /* ignore quota */
      }
      setSessionToken(token);
    },
    [matchKey],
  );

  const clearSession = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKeyFor(matchKey));
    } catch {
      /* ignore */
    }
    setSessionToken(null);
    setVideoUrl(null);
    setPosterUrl(null);
    setCode("");
    setError(null);
  }, [matchKey]);

  const loadStream = useCallback(
    async (token: string) => {
      setStreamLoading(true);
      setError(null);
      try {
        const res = await fetch(`${base}/api/replays/access/stream`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => null)) as { videoUrl?: string; posterUrl?: string | null; error?: string } | null;
        if (!res.ok) {
          if (res.status === 401) {
            clearSession();
          }
          throw new Error(body?.error ?? "No se pudo cargar el video");
        }
        if (!body?.videoUrl || typeof body.videoUrl !== "string") {
          throw new Error("Respuesta inválida del servidor");
        }
        setVideoUrl(body.videoUrl);
        setPosterUrl(typeof body.posterUrl === "string" && body.posterUrl.trim() !== "" ? body.posterUrl : null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error de red");
      } finally {
        setStreamLoading(false);
      }
    },
    [base, clearSession],
  );

  useEffect(() => {
    if (!base) {
      return;
    }
    try {
      const raw = sessionStorage.getItem(storageKeyFor(matchKey));
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as { matchKey?: string; token?: string };
      if (parsed.matchKey !== matchKey || typeof parsed.token !== "string") {
        return;
      }
      setSessionToken(parsed.token);
      void loadStream(parsed.token);
    } catch {
      /* ignore */
    }
    // Solo restauración al montar / cambiar partido (evita loops por loadStream).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, matchKey]);

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!hasApi) {
      setError("El acceso a replays no esta disponible en este momento. Intentalo nuevamente en unos minutos.");
      return;
    }
    setVerifyLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/api/replays/access/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchKey, code }),
      });
      const body = (await res.json().catch(() => null)) as
        | { sessionToken?: string; error?: string }
        | null;

      if (!res.ok || !body?.sessionToken || typeof body.sessionToken !== "string") {
        throw new Error(body?.error ?? "Código incorrecto");
      }

      persistSession(body.sessionToken);
      await loadStream(body.sessionToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo validar el código");
    } finally {
      setVerifyLoading(false);
    }
  };

  const resolvedPoster = posterUrl ?? posterFallback;

  if (videoUrl) {
    if (cinema) {
      const player = (
        <MatchPlayerZoom
          videoSrc={videoUrl}
          poster={resolvedPoster}
          clockLabel={clockLabel}
          chromeVariant="ghost"
          layout="fill"
        />
      );
      if (embedCinema) {
        return (
          <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-black">{player}</div>
        );
      }
      return (
        <main className="fixed inset-0 z-50 m-0 min-h-dvh w-full overflow-y-auto overflow-x-hidden bg-black p-0">
          {player}
        </main>
      );
    }

    return (
      <div>
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => clearSession()}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:bg-slate-50"
          >
            Salir / otro código
          </button>
        </div>
        <ReplayMatchBlock videoSrc={videoUrl} poster={resolvedPoster} clockLabel={clockLabel} />
      </div>
    );
  }

  const gateCard = (
    <div className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Acceso al replay</p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">Ingresá el código del club</h2>
      <p className="mt-2 text-sm text-slate-600">
        El acceso es con código que te damos después del pago (efectivo o alias). ¿No tenés código? Pedilo por
        WhatsApp del club o en recepción.
      </p>

      {!hasApi && (
        <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900">
          El acceso a replays se encuentra temporalmente en mantenimiento.
        </p>
      )}

      <div className="mt-5">
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[#25D366] bg-[#25D366] text-sm font-black uppercase tracking-wider text-white shadow-sm transition hover:bg-[#20bd5a]"
          >
            <span aria-hidden>💬</span>
            Pedir código por WhatsApp
          </a>
        ) : (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-600">
            Si no tenes codigo, pedilo en recepcion del club.
          </p>
        )}
      </div>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">Código</span>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            autoComplete="one-time-code"
            inputMode="text"
            placeholder="Ej: DEMO1234"
            className="h-12 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-vj-green"
          />
        </label>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={verifyLoading || streamLoading || code.trim().length < 4 || !hasApi}
          className="flex h-12 w-full items-center justify-center rounded-md bg-vj-green text-sm font-black uppercase tracking-wider text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {verifyLoading || streamLoading ? "Verificando..." : "Ver replay"}
        </button>
        {!hasApi && (
          <p className="text-center text-xs font-medium text-slate-500">Temporalmente fuera de servicio.</p>
        )}
      </form>

      {sessionToken && streamLoading && (
        <p className="mt-4 text-center text-sm font-semibold text-slate-600">Cargando video…</p>
      )}
    </div>
  );

  return wrapCinemaEmbed(cinema && embedCinema, gateCard);
}
