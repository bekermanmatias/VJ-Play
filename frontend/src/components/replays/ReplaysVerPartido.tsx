import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, X, CreditCard } from "lucide-react";
import { FALLBACK_REPLAY_COURTS, loadReplayCourts } from "@/utils/replay-courts-api";
import type { ReplayDateOption } from "@/utils/replay-date-options";
import { loadReplayShiftConfig } from "@/utils/replay-shift-config-api";
import {
  buildReplayShiftTurnosFromConfig,
  getDefaultReplayShiftConfigFromEnv,
  type ReplayShiftConfig,
} from "@/utils/replay-shift-turnos";
import { getReplayApiBaseFromEnv } from "@/utils/replay-api-base";

const apiBase = getReplayApiBaseFromEnv();

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
      <label htmlFor={id} className="vj-field-label">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onPick(e.target.value)}
          className={`vj-field appearance-none pl-3 outline-none transition ${showCalendarIcon ? "pr-14" : "pr-10"}`}
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

export default function ReplaysVerPartido({ initialDates }: { initialDates: ReplayDateOption[] }) {
  const [shiftConfig, setShiftConfig] = useState<ReplayShiftConfig>(() =>
    getDefaultReplayShiftConfigFromEnv(),
  );
  const turnos = useMemo(() => buildReplayShiftTurnosFromConfig(shiftConfig), [shiftConfig]);
  const fechas = initialDates;
  const [courtOptions, setCourtOptions] = useState<Option[]>(() =>
    FALLBACK_REPLAY_COURTS.map((c) => ({ value: c.slug, label: c.label })),
  );
  const [cancha, setCancha] = useState("");
  const [fecha, setFecha] = useState(() => initialDates[0]?.value ?? "");
  const [hora, setHora] = useState("");
  const [checkingMatch, setCheckingMatch] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const [notFoundMsg, setNotFoundMsg] = useState("El turno seleccionado no existe o ya no está disponible.");

  useEffect(() => {
    let cancelled = false;
    void loadReplayShiftConfig(apiBase).then((c) => {
      if (!cancelled) setShiftConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadReplayCourts(apiBase).then((p) => {
      if (cancelled) return;
      setCourtOptions(p.courts.map((c) => ({ value: c.slug, label: c.label })));
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!cancha || !fecha || !hora) return;

    setCheckingMatch(true);
    try {
      const base = apiBase.trim().replace(/\/$/, "");
      if (!base) {
        throw new Error("El servicio de replays no está disponible en este momento.");
      }

      const matchKey = `${cancha}|${fecha}|${hora}`;

      // 1. Check if match exists
      const existsUrl = new URL(`${base}/api/replays/access/exists`);
      existsUrl.searchParams.set("matchKey", matchKey);
      const existsRes = await fetch(existsUrl.toString());
      const existsBody = (await existsRes.json().catch(() => null)) as
        | { exists?: boolean; error?: string }
        | null;
      if (!existsRes.ok) {
        throw new Error(existsBody?.error ?? "No se pudo validar el turno.");
      }
      if (!existsBody?.exists) {
        setNotFoundMsg("El turno seleccionado no existe o ya no está disponible.");
        setNotFoundOpen(true);
        return;
      }

      // 2. Create payment preference and redirect to MP checkout
      setCheckingMatch(false);
      setPaymentLoading(true);

      const paymentRes = await fetch(`${base}/api/replays/payment/create-preference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchKey }),
      });
      const paymentBody = (await paymentRes.json().catch(() => null)) as {
        initPoint?: string;
        accessToken?: string;
        error?: string;
      } | null;

      if (!paymentRes.ok || !paymentBody?.initPoint) {
        throw new Error(paymentBody?.error ?? "No se pudo crear el pago.");
      }

      // Save access token in sessionStorage for the return page
      if (paymentBody.accessToken) {
        try {
          sessionStorage.setItem(`vj_replay_payment:${matchKey}`, paymentBody.accessToken);
        } catch { /* ignore */ }
      }

      // Redirect to Mercado Pago checkout
      window.location.href = paymentBody.initPoint;

    } catch (err) {
      setNotFoundMsg(err instanceof Error ? err.message : "No se pudo validar el turno.");
      setNotFoundOpen(true);
    } finally {
      setCheckingMatch(false);
      setPaymentLoading(false);
    }
  };

  useEffect(() => {
    if (!notFoundOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (notFoundOpen) setNotFoundOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      document.removeEventListener("keydown", onKey);
    };
  }, [notFoundOpen]);

  return (
    <>
      <form
        id="replays-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6"
        aria-busy={checkingMatch || paymentLoading}
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
          <span className="vj-field-label">
            Accion
          </span>
          <button
            type="submit"
            disabled={checkingMatch || paymentLoading || !cancha || !fecha || !hora}
            className="flex h-12 w-full items-center justify-center gap-2 bg-[#009ee3] px-4 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#007eb5] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {checkingMatch ? (
              "Verificando..."
            ) : paymentLoading ? (
              "Procesando pago..."
            ) : (
              <>
                <CreditCard size={16} />
                COMPRAR REPLAY — {formatPrice(REPLAY_PRICE)}
              </>
            )}
          </button>
        </div>
      </form>

      {notFoundOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setNotFoundOpen(false)}
        >
          <div
            className="relative w-full max-w-md border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setNotFoundOpen(false)}
              className="absolute right-3 top-3 p-1 text-slate-500 transition hover:bg-slate-100"
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
                className="inline-flex h-10 items-center bg-vj-green px-4 text-sm font-bold uppercase tracking-wider text-white hover:bg-vj-green-600"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
