import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { X, CreditCard, ExternalLink } from "lucide-react";
import MatchPlayerZoom from "@/components/replays/MatchPlayerZoom";
import ReplayMatchBlock from "@/components/replays/ReplayMatchBlock";

type Props = {
  matchKey: string;
  apiBase: string;
  cinema: boolean;
  /** Dentro de un modal fullscreen ya existente (ej. Replays): evita otro `main` fixed a pantalla completa. */
  embedCinema?: boolean;
  /** Cierre opcional del modal contenedor (si existe). */
  onClose?: () => void;
  /** Token inicial opcional (ej. apertura en otra pestaña). */
  initialSessionToken?: string | null;
  /** Access token de pago (link permanente). */
  accessToken?: string | null;
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

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const REPLAY_PRICE = (() => {
  const raw = import.meta.env.PUBLIC_REPLAY_PRICE_ARS;
  if (raw) {
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 3500;
})();

export default function MatchReplayGate({
  matchKey,
  apiBase,
  cinema,
  embedCinema = false,
  onClose,
  initialSessionToken = null,
  accessToken: propAccessToken = null,
  clockLabel,
  posterFallback,
}: Props) {
  const base = useMemo(() => apiBase.trim().replace(/\/$/, ""), [apiBase]);
  const hasApi = base.length > 0;

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [fullMatchSizeBytes, setFullMatchSizeBytes] = useState<number | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchExists, setMatchExists] = useState<boolean | null>(null);
  const [existsLoading, setExistsLoading] = useState(false);

  // --- Payment state ---
  const [paymentLoading, setPaymentLoading] = useState(false);

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
    setFullMatchSizeBytes(null);
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
        const body = (await res.json().catch(() => null)) as {
          videoUrl?: string;
          posterUrl?: string | null;
          videoSizeBytes?: number | null;
          error?: string;
        } | null;
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
        const sz = body.videoSizeBytes;
        setFullMatchSizeBytes(
          typeof sz === "number" && Number.isFinite(sz) && sz > 0 ? sz : null,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error de red");
      } finally {
        setStreamLoading(false);
      }
    },
    [base, clearSession],
  );

  // --- Check if match exists ---
  useEffect(() => {
    if (!base) return;
    let cancelled = false;
    setExistsLoading(true);
    setMatchExists(null);
    setError(null);
    const url = new URL(`${base}/api/replays/access/exists`);
    url.searchParams.set("matchKey", matchKey);
    void fetch(url.toString())
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as {
          exists?: boolean;
          error?: string;
        } | null;
        if (cancelled) return;
        if (!res.ok) throw new Error(body?.error ?? "No se pudo validar el partido");
        setMatchExists(body?.exists === true);
      })
      .catch((e) => {
        if (cancelled) return;
        setMatchExists(false);
        setError(e instanceof Error ? e.message : "No se pudo validar el partido");
      })
      .finally(() => {
        if (!cancelled) setExistsLoading(false);
      });
    return () => { cancelled = true; };
  }, [base, matchKey]);

  // --- Auto-authenticate from accessToken (payment link) ---
  useEffect(() => {
    if (!base || matchExists !== true) return;
    const token = propAccessToken;
    if (!token) return;

    let cancelled = false;
    setStreamLoading(true);
    setError(null);

    void fetch(`${base}/api/replays/payment/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as {
          sessionToken?: string;
          error?: string;
        } | null;
        if (cancelled) return;
        if (!res.ok || !body?.sessionToken) {
          throw new Error(body?.error ?? "No se pudo validar el acceso");
        }
        persistSession(body.sessionToken);
        return loadStream(body.sessionToken);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "No se pudo validar el acceso");
        setStreamLoading(false);
      });

    return () => { cancelled = true; };
  }, [base, matchExists, propAccessToken, persistSession, loadStream]);

  // --- Restore session from sessionStorage (only if no accessToken) ---
  useEffect(() => {
    if (!base || matchExists !== true) return;
    if (propAccessToken) return; // access token flow takes precedence
    if (typeof initialSessionToken === "string" && initialSessionToken.trim() !== "") {
      setSessionToken(initialSessionToken);
      void loadStream(initialSessionToken);
      return;
    }
    try {
      const raw = sessionStorage.getItem(storageKeyFor(matchKey));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { matchKey?: string; token?: string };
      if (parsed.matchKey !== matchKey || typeof parsed.token !== "string") return;
      setSessionToken(parsed.token);
      void loadStream(parsed.token);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, initialSessionToken, matchExists, matchKey, propAccessToken]);

  // --- Initiate payment ---
  const onBuyAccess = async () => {
    if (!hasApi) {
      setError("El servicio de replays no está disponible en este momento.");
      return;
    }
    setPaymentLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/api/replays/payment/create-preference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchKey }),
      });
      const body = (await res.json().catch(() => null)) as {
        initPoint?: string;
        accessToken?: string;
        error?: string;
      } | null;
      if (!res.ok || !body?.initPoint) {
        throw new Error(body?.error ?? "No se pudo crear el pago");
      }
      // Save the access token for the return URL
      if (body.accessToken) {
        try {
          sessionStorage.setItem(`vj_replay_payment:${matchKey}`, body.accessToken);
        } catch { /* ignore */ }
      }
      // Redirect to Mercado Pago checkout
      window.location.href = body.initPoint;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago");
    } finally {
      setPaymentLoading(false);
    }
  };



  const resolvedPoster = posterUrl ?? posterFallback;

  // --- Loading state ---
  if (existsLoading) {
    const loadingCard = (
      <div className="mx-auto w-full max-w-md border border-slate-200 bg-white p-6 text-center shadow-lg">
        <p className="text-sm font-semibold text-slate-700">Verificando partido...</p>
      </div>
    );
    return wrapCinemaEmbed(cinema && embedCinema, loadingCard);
  }

  // --- Not found ---
  if (matchExists === false) {
    const notFoundCard = (
      <div className="mx-auto w-full max-w-md border border-rose-200 bg-white p-6 shadow-lg">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700">Replay</p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">Partido no encontrado</h2>
        <p className="mt-2 text-sm text-slate-600">
          El turno que intentaste abrir no existe o ya no está disponible.
        </p>
        <a
          href="/replays"
          className="mt-5 inline-flex h-11 w-full items-center justify-center bg-vj-green px-4 text-sm font-black uppercase tracking-wider text-white transition hover:bg-vj-green-600"
        >
          Volver al buscador
        </a>
      </div>
    );
    return wrapCinemaEmbed(cinema && embedCinema, notFoundCard);
  }

  // --- Video loaded → show player ---
  if (videoUrl) {
    if (cinema) {
      const player = (
        <MatchPlayerZoom
          videoSrc={videoUrl}
          poster={resolvedPoster}
          clockLabel={clockLabel}
          apiBase={base}
          matchKey={matchKey}
          sessionToken={sessionToken}
          fullMatchSizeBytes={fullMatchSizeBytes}
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
        <main className="fixed inset-0 z-50 m-0 min-h-dvh w-full overflow-hidden bg-black p-0">
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
            className="border border-slate-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:bg-slate-50"
          >
            Salir
          </button>
        </div>
        <ReplayMatchBlock
          apiBase={base}
          matchKey={matchKey}
          sessionToken={sessionToken}
          videoSrc={videoUrl}
          poster={resolvedPoster}
          clockLabel={clockLabel}
          fullMatchSizeBytes={fullMatchSizeBytes}
        />
      </div>
    );
  }

  // --- Cinema loading state ---
  if (cinema && sessionToken && (streamLoading)) {
    const openingState = (
      <div className="flex min-h-dvh w-full items-center justify-center bg-black text-sm font-semibold text-white">
        Cargando video...
      </div>
    );
    if (embedCinema) {
      return (
        <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-black">
          {openingState}
        </div>
      );
    }
    return openingState;
  }

  // --- Payment gate (replaces code entry) ---
  const gateCard = (
    <div
      className="relative mx-auto w-full max-w-md border border-slate-200 bg-white p-6 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 p-1 text-slate-500 transition hover:bg-slate-100"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      )}
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Acceso al replay</p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">Comprá el acceso a tu partido</h2>
      <p className="mt-2 text-sm text-slate-600">
        Pagá con Mercado Pago y recibí un link para ver y descargar tu partido desde cualquier dispositivo.
      </p>

      {!hasApi && (
        <p className="mt-4 border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900">
          El acceso a replays se encuentra temporalmente en mantenimiento.
        </p>
      )}

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">Replay del partido</span>
          <span className="text-lg font-black text-slate-900">{formatPrice(REPLAY_PRICE)}</span>
        </div>

        {error && (
          <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onBuyAccess}
          disabled={paymentLoading || streamLoading || !hasApi}
          className="flex h-12 w-full items-center justify-center gap-2 bg-[#009ee3] text-sm font-black uppercase tracking-wider text-white transition hover:bg-[#007eb5] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {paymentLoading || streamLoading ? (
            "Procesando..."
          ) : (
            <>
              <CreditCard size={18} />
              Pagar con Mercado Pago
            </>
          )}
        </button>

        {!hasApi && (
          <p className="text-center text-xs font-medium text-slate-500">Temporalmente fuera de servicio.</p>
        )}
      </div>

      <div className="mt-5 flex items-start gap-2 border-t border-slate-200 pt-4">
        <ExternalLink size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
        <p className="text-xs text-slate-500">
          Al pagar, recibirás un <span className="font-bold text-slate-700">link permanente</span> para acceder
          desde cualquier dispositivo sin volver a pagar.
        </p>
      </div>
    </div>
  );

  return wrapCinemaEmbed(cinema && embedCinema, gateCard);
}
