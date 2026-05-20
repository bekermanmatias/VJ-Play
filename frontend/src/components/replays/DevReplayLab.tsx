import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { buildReplayMatchKey } from "@/utils/replay-match-key";
import { getReplayApiBaseFromEnv } from "@/utils/replay-api-base";

type VerifyResponse = {
  sessionToken: string;
  expiresAt: string;
};

type StreamResponse = {
  videoUrl: string;
  posterUrl: string | null;
  videoSizeBytes?: number | null;
};

const DEFAULT_CANCHA = "cancha-padel";
const DEFAULT_FECHA = "2026-05-07";
const DEFAULT_HORA = "13:00";
const DEFAULT_CODE = "CLUB1234";

export default function DevReplayLab() {
  const apiBase = getReplayApiBaseFromEnv();
  const [cancha, setCancha] = useState(DEFAULT_CANCHA);
  const [fecha, setFecha] = useState(DEFAULT_FECHA);
  const [hora, setHora] = useState(DEFAULT_HORA);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [adminSecret, setAdminSecret] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [verifyResult, setVerifyResult] = useState<string>("");
  const [streamResult, setStreamResult] = useState<string>("");
  const [createCodeResult, setCreateCodeResult] = useState<string>("");
  const [loadingCreateCode, setLoadingCreateCode] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingStream, setLoadingStream] = useState(false);

  const matchKey = useMemo(() => buildReplayMatchKey({ cancha, fecha, hora }), [cancha, fecha, hora]);
  const replayUrl = useMemo(() => {
    const params = new URLSearchParams({ cancha, fecha, hora });
    return `/replays/partido?${params.toString()}`;
  }, [cancha, fecha, hora]);

  const apiReady = apiBase.length > 0;

  async function handleCreateCode(ev: FormEvent) {
    ev.preventDefault();
    if (!apiReady) {
      setCreateCodeResult("Configura PUBLIC_REPLAY_API_BASE en frontend/.env");
      return;
    }
    if (!adminSecret.trim()) {
      setCreateCodeResult("Falta ADMIN_SECRET");
      return;
    }

    setLoadingCreateCode(true);
    setCreateCodeResult("");
    try {
      const res = await fetch(`${apiBase}/api/replays/access/codes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({ matchKey, plainCode: code }),
      });
      const body = (await res.json().catch(() => null)) as { tokenHash?: string; error?: string } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      setCreateCodeResult(`Codigo creado. tokenHash: ${body?.tokenHash ?? "-"}`);
    } catch (error) {
      setCreateCodeResult(error instanceof Error ? error.message : "No se pudo crear el codigo");
    } finally {
      setLoadingCreateCode(false);
    }
  }

  async function handleVerify(ev: FormEvent) {
    ev.preventDefault();
    if (!apiReady) {
      setVerifyResult("Configura PUBLIC_REPLAY_API_BASE en frontend/.env");
      return;
    }

    setLoadingVerify(true);
    setVerifyResult("");
    try {
      const res = await fetch(`${apiBase}/api/replays/access/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchKey, code }),
      });
      const body = (await res.json().catch(() => null)) as Partial<VerifyResponse> & { error?: string };
      if (!res.ok || !body.sessionToken) {
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      setSessionToken(body.sessionToken);
      setVerifyResult(`OK. Expira: ${body.expiresAt ?? "-"}`);
    } catch (error) {
      setVerifyResult(error instanceof Error ? error.message : "No se pudo validar");
    } finally {
      setLoadingVerify(false);
    }
  }

  async function handleStream() {
    if (!apiReady) {
      setStreamResult("Configura PUBLIC_REPLAY_API_BASE en frontend/.env");
      return;
    }
    if (!sessionToken.trim()) {
      setStreamResult("Primero valida el codigo para obtener sessionToken");
      return;
    }

    setLoadingStream(true);
    setStreamResult("");
    try {
      const res = await fetch(`${apiBase}/api/replays/access/stream`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const body = (await res.json().catch(() => null)) as Partial<StreamResponse> & { error?: string };
      if (!res.ok) {
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      const sz =
        typeof body.videoSizeBytes === "number" && body.videoSizeBytes > 0
          ? `${body.videoSizeBytes} bytes`
          : "-";
      setStreamResult(
        `OK. videoUrl: ${body.videoUrl ?? "-"}\nposterUrl: ${body.posterUrl ?? "-"}\nvideoSizeBytes: ${sz}`,
      );
    } catch (error) {
      setStreamResult(error instanceof Error ? error.message : "No se pudo cargar stream");
    } finally {
      setLoadingStream(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Configuracion</p>
        <p className="mt-2 text-sm text-slate-700">
          API base: <span className="font-mono">{apiBase || "(no configurada)"}</span>
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Partido de prueba</p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Cancha
            <input
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 font-mono text-sm"
              value={cancha}
              onChange={(e) => setCancha(e.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Fecha
            <input
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 font-mono text-sm"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Hora
            <input
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 font-mono text-sm"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-3 text-sm text-slate-700">
          matchKey: <span className="rounded bg-slate-100 px-2 py-1 font-mono">{matchKey}</span>
        </p>
        <p className="mt-2 text-sm text-slate-700">
          URL directa:{" "}
          <a className="font-mono text-vj-green underline" href={replayUrl} target="_blank" rel="noreferrer">
            {replayUrl}
          </a>
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Crear codigo (admin)</p>
        <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3" onSubmit={handleCreateCode}>
          <label className="text-sm font-semibold text-slate-700 md:col-span-1">
            Codigo
            <input
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 font-mono text-sm"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            ADMIN_SECRET
            <input
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 font-mono text-sm"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="Se envia en header x-admin-secret"
            />
          </label>
          <button
            type="submit"
            disabled={loadingCreateCode}
            className="h-10 rounded-md bg-slate-900 px-4 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {loadingCreateCode ? "Creando..." : "Crear codigo"}
          </button>
        </form>
        {createCodeResult && (
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-100 p-3 text-xs text-slate-800">
            {createCodeResult}
          </pre>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Validar y probar stream</p>
        <form className="mt-4 flex flex-col gap-3 md:flex-row md:items-end" onSubmit={handleVerify}>
          <label className="text-sm font-semibold text-slate-700">
            Codigo
            <input
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 font-mono text-sm"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={loadingVerify}
            className="h-10 rounded-md bg-vj-green px-4 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {loadingVerify ? "Validando..." : "Validar codigo"}
          </button>
          <button
            type="button"
            onClick={handleStream}
            disabled={loadingStream}
            className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold uppercase tracking-wider text-slate-800 disabled:opacity-50"
          >
            {loadingStream ? "Consultando..." : "Probar stream"}
          </button>
        </form>
        <label className="mt-3 block text-sm font-semibold text-slate-700">
          sessionToken
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border border-slate-300 p-3 font-mono text-xs"
            value={sessionToken}
            onChange={(e) => setSessionToken(e.target.value)}
          />
        </label>
        {verifyResult && (
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-100 p-3 text-xs text-slate-800">{verifyResult}</pre>
        )}
        {streamResult && (
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-100 p-3 text-xs text-slate-800">{streamResult}</pre>
        )}
      </section>
    </div>
  );
}
