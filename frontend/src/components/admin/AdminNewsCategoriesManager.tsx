import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import {
  adminListCategories,
  adminReplaceCategories,
  type NewsCategory,
} from "@/utils/news-api";
import { getReplayAdminSecret } from "@/utils/replay-admin-secret";
import { getReplayApiBaseFromEnv } from "@/utils/replay-api-base";

const apiBase = getReplayApiBaseFromEnv();
const adminSecret = getReplayAdminSecret();

type Row = {
  slug: string;
  label: string;
  sortOrder: number;
  active: boolean;
};

function slugify(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export default function AdminNewsCategoriesManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const hasApiBase = Boolean(apiBase);
  const hasSecret = Boolean(adminSecret);

  const refresh = useCallback(async () => {
    if (!hasApiBase || !hasSecret) return;
    setLoading(true);
    setError(null);
    try {
      const list = await adminListCategories(apiBase, adminSecret);
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
      setRows(list.map(toRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar categorías");
    } finally {
      setLoading(false);
    }
  }, [hasApiBase, hasSecret]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { slug: "", label: "", sortOrder: (prev[prev.length - 1]?.sortOrder ?? 0) + 10, active: true },
    ]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const cleaned = rows.map((r, i) => {
        const slug = (r.slug.trim() || slugify(r.label)).toLowerCase();
        if (!slug) {
          throw new Error(`Fila ${i + 1}: slug o nombre obligatorio`);
        }
        if (!r.label.trim()) {
          throw new Error(`Fila ${i + 1}: nombre obligatorio`);
        }
        return { ...r, slug };
      });

      const seen = new Set<string>();
      for (const r of cleaned) {
        if (seen.has(r.slug)) {
          throw new Error(`Slug duplicado: ${r.slug}`);
        }
        seen.add(r.slug);
      }

      const saved = await adminReplaceCategories(
        apiBase,
        adminSecret,
        cleaned.map((r) => ({
          slug: r.slug,
          label: r.label.trim(),
          sortOrder: r.sortOrder,
          active: r.active,
        })),
      );
      saved.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
      setRows(saved.map(toRow));
      setMsg("Categorías guardadas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!hasApiBase) {
    return (
      <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Falta configurar <code>PUBLIC_REPLAY_API_BASE</code>.
      </div>
    );
  }
  if (!hasSecret) {
    return (
      <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Falta configurar <code>PUBLIC_REPLAY_ADMIN_SECRET</code>.
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Categorías de noticias
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Por defecto coinciden con los deportes del club. Podés agregar nuevas o desactivar las
            que no quieras ofrecer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:border-vj-green hover:text-vj-green"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-vj-green px-3 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </button>
        </div>
      </header>

      {error && (
        <p className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      {msg && (
        <p className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </p>
      )}

      <div className="overflow-x-auto border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                Slug
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                Nombre
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                Orden
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                Activa
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={`${r.slug}-${i}`}>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={r.slug}
                    onChange={(e) => updateRow(i, { slug: e.target.value })}
                    placeholder="se-genera-del-nombre"
                    className="w-full border border-slate-300 px-2 py-1 text-sm outline-none focus:border-vj-green focus:ring-1 focus:ring-vj-green/40"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={r.label}
                    onChange={(e) => updateRow(i, { label: e.target.value })}
                    className="w-full border border-slate-300 px-2 py-1 text-sm outline-none focus:border-vj-green focus:ring-1 focus:ring-vj-green/40"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={r.sortOrder}
                    onChange={(e) => updateRow(i, { sortOrder: Number(e.target.value) || 0 })}
                    className="w-24 border border-slate-300 px-2 py-1 text-sm outline-none focus:border-vj-green focus:ring-1 focus:ring-vj-green/40"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => updateRow(i, { active: e.target.checked })}
                    className="h-4 w-4 border-slate-300 text-vj-green focus:ring-vj-green"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-rose-700 hover:text-rose-900"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Quitar
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No hay categorías. Agregá una con el botón de arriba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function toRow(c: NewsCategory): Row {
  return {
    slug: c.slug,
    label: c.label,
    sortOrder: c.sortOrder,
    active: c.active,
  };
}
