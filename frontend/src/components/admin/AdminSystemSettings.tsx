import { Power, ShieldCheck } from "lucide-react";

export default function AdminSystemSettings() {
  const runProtectedAction = (label: string) => {
    const ok = window.confirm(`Vas a ejecutar: ${label}.\nDeseas continuar?`);
    if (!ok) return;
    window.alert(`${label} enviado (demo).`);
  };

  return (
    <div>
      <section className="py-1">
        <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
          Gestion del Sistema
        </h2>
        <p className="mt-2 max-w-3xl text-base text-slate-700">
          Seccion restringida para dueno y soporte tecnico.
        </p>
      </section>

      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        Acceso sensible: ejecutar acciones solo con autorizacion.
      </div>

      <section className="mt-6">
        <article className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
            Modulo de Hardware
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Herramientas para resolver cortes de conectividad sin asistencia en sitio.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runProtectedAction("Reiniciar router a distancia")}
              className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
            >
              <Power size={16} />
              Reiniciar router a distancia
            </button>

            <button
              type="button"
              onClick={() => runProtectedAction("Forzar reconexion de VPN")}
              className="inline-flex items-center gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100"
            >
              <ShieldCheck size={16} />
              Forzar reconexion de VPN
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}