import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Edit2,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  adminCreateBanner,
  adminDeleteBanner,
  adminListBanners,
  adminUpdateBanner,
  adminUploadBannerImage,
  getBannersApiBase,
  type BannerUpsertInput,
  type HomeBanner,
} from "@/utils/banners-api";
import { getReplayAdminSecret } from "@/utils/replay-admin-secret";
import { getReplayApiBaseFromEnv } from "@/utils/replay-api-base";

const apiBase = getReplayApiBaseFromEnv();
const adminSecret = getReplayAdminSecret();

type FormState = {
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonUrl: string;
  active: boolean;
  sortOrder: number;
};

const emptyForm: FormState = {
  title: "",
  subtitle: "",
  buttonLabel: "",
  buttonUrl: "",
  active: true,
  sortOrder: 0,
};

function toForm(b: HomeBanner): FormState {
  return {
    title: b.title,
    subtitle: b.subtitle,
    buttonLabel: b.buttonLabel,
    buttonUrl: b.buttonUrl,
    active: b.active,
    sortOrder: b.sortOrder,
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminBannersManager() {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor panel
  const [editing, setEditing] = useState<HomeBanner | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Image upload
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await adminListBanners(apiBase, adminSecret);
      setBanners(list.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---------------------------------------------------------------------------
  // Actions on list
  // ---------------------------------------------------------------------------

  const toggleActive = useCallback(async (b: HomeBanner) => {
    try {
      const updated = await adminUpdateBanner(apiBase, adminSecret, b.id, { active: !b.active });
      setBanners((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    }
  }, []);

  const moveOrder = useCallback(async (b: HomeBanner, dir: -1 | 1) => {
    const sorted = [...banners].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((x) => x.id === b.id);
    const target = sorted[idx + dir];
    if (!target) return;
    try {
      const [u1, u2] = await Promise.all([
        adminUpdateBanner(apiBase, adminSecret, b.id, { sortOrder: target.sortOrder }),
        adminUpdateBanner(apiBase, adminSecret, target.id, { sortOrder: b.sortOrder }),
      ]);
      setBanners((prev) => prev.map((x) => x.id === u1.id ? u1 : x.id === u2.id ? u2 : x));
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    }
  }, [banners]);

  const handleDelete = useCallback(async (b: HomeBanner) => {
    if (!confirm(`¿Eliminar el banner "${b.title}"?`)) return;
    try {
      await adminDeleteBanner(apiBase, adminSecret, b.id);
      setBanners((prev) => prev.filter((x) => x.id !== b.id));
      if (editing?.id === b.id) { setEditing(null); setIsNew(false); }
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    }
  }, [editing]);

  // ---------------------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------------------

  const openNew = () => {
    setIsNew(true);
    setEditing(null);
    setForm({ ...emptyForm, sortOrder: banners.length * 10 });
    setSaveError(null);
  };

  const openEdit = (b: HomeBanner) => {
    setIsNew(false);
    setEditing(b);
    setForm(toForm(b));
    setSaveError(null);
  };

  const closeEditor = () => { setEditing(null); setIsNew(false); setSaveError(null); };

  const handleSave = async () => {
    if (!form.title.trim()) { setSaveError("El título es requerido"); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const input: BannerUpsertInput = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        buttonLabel: form.buttonLabel.trim(),
        buttonUrl: form.buttonUrl.trim(),
        active: form.active,
        sortOrder: form.sortOrder,
      };
      if (isNew) {
        const created = await adminCreateBanner(apiBase, adminSecret, input);
        setBanners((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
        setEditing(created);
        setIsNew(false);
      } else if (editing) {
        const updated = await adminUpdateBanner(apiBase, adminSecret, editing.id, input);
        setBanners((prev) => prev.map((x) => x.id === updated.id ? updated : x).sort((a, b) => a.sortOrder - b.sortOrder));
        setEditing(updated);
      }
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading(true);
    try {
      const updated = await adminUploadBannerImage(apiBase, adminSecret, editing.id, file);
      setBanners((prev) => prev.map((x) => x.id === updated.id ? updated : x));
      setEditing(updated);
    } catch (e) {
      alert(`Error subiendo imagen: ${(e as Error).message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const sorted = [...banners].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Banners del Home</h1>
          <p className="mt-1 text-sm text-slate-500">Gestioná los slides del carousel principal.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-emerald-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow transition hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo banner
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        {/* Banner list */}
        <div className="space-y-3">
          {sorted.map((b, idx) => (
            <div
              key={b.id}
              className={`flex items-start gap-3 border bg-white p-4 shadow-sm transition ${editing?.id === b.id ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200 hover:border-slate-300"}`}
            >
              {/* Thumbnail */}
              <div className="h-16 w-28 flex-shrink-0 overflow-hidden bg-slate-100">
                {b.imageUrl ? (
                  <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">Sin imagen</div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${b.active ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <p className="truncate text-sm font-bold text-slate-900">{b.title}</p>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">{b.subtitle || "—"}</p>
                {b.buttonUrl && (
                  <p className="mt-0.5 truncate text-xs text-slate-400">→ {b.buttonUrl}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-shrink-0 items-center gap-1">
                <button onClick={() => moveOrder(b, -1)} disabled={idx === 0} title="Subir" className="p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-30">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => moveOrder(b, 1)} disabled={idx === sorted.length - 1} title="Bajar" className="p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-30">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => toggleActive(b)} title={b.active ? "Desactivar" : "Activar"} className="p-1.5 text-slate-400 transition hover:text-slate-700">
                  {b.active ? <Eye className="h-3.5 w-3.5 text-emerald-600" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => openEdit(b)} title="Editar" className="p-1.5 text-slate-400 transition hover:text-emerald-600">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(b)} title="Eliminar" className="p-1.5 text-slate-400 transition hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {!loading && sorted.length === 0 && (
            <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
              No hay banners todavía. Creá el primero.
            </div>
          )}
        </div>

        {/* Editor panel */}
        {(editing || isNew) && (
          <div className="border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                {isNew ? "Nuevo banner" : "Editar banner"}
              </h2>
              <button onClick={closeEditor} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Título *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  placeholder="Disfrutá el Club"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Subtítulo</label>
                <input
                  value={form.subtitle}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                  className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  placeholder="Todo el año"
                />
              </div>

              {/* Button label + URL */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Texto botón</label>
                  <input
                    value={form.buttonLabel}
                    onChange={(e) => setForm((f) => ({ ...f, buttonLabel: e.target.value }))}
                    className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="Ver más"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">URL del botón</label>
                  <input
                    value={form.buttonUrl}
                    onChange={(e) => setForm((f) => ({ ...f, buttonUrl: e.target.value }))}
                    className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="/socios"
                  />
                </div>
              </div>

              {/* Sort order + Active */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Orden</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                    className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex cursor-pointer items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Activo</span>
                  </label>
                </div>
              </div>

              {saveError && <p className="text-xs text-red-600">{saveError}</p>}

              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 bg-emerald-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isNew ? "Crear banner" : "Guardar cambios"}
              </button>

              {/* Image upload — solo disponible después de crear */}
              {editing && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Imagen de fondo</p>
                  {editing.imageUrl && (
                    <img src={editing.imageUrl} alt="preview" className="mb-2 h-24 w-full object-cover" />
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex w-full items-center justify-center gap-2 border border-slate-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 transition hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Subiendo..." : "Subir imagen"}
                  </button>
                  <p className="mt-1 text-[10px] text-slate-400">Máx. 10 MB. Se optimiza automáticamente a JPEG.</p>
                </div>
              )}
              {isNew && (
                <p className="text-xs text-slate-400">Guardá el banner primero para poder subir la imagen.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
