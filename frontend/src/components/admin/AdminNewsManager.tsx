import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Star,
  StarOff,
  Trash2,
  Upload,
} from "lucide-react";
import {
  adminCreateNews,
  adminDeleteNews,
  adminDeleteNewsImage,
  adminListCategories,
  adminListNews,
  adminSetNewsImageMain,
  adminUpdateNews,
  adminUploadNewsImage,
  type News,
  type NewsCategory,
} from "@/utils/news-api";
import { getReplayAdminSecret } from "@/utils/replay-admin-secret";
import { getReplayApiBaseFromEnv } from "@/utils/replay-api-base";

const MAX_IMAGES = 5;
const apiBase = getReplayApiBaseFromEnv();
const adminSecret = getReplayAdminSecret();

type FormState = {
  title: string;
  slug: string;
  summary: string;
  body: string;
  author: string;
  published: boolean;
  publishedAt: string;
  categorySlugs: string[];
};

const emptyForm: FormState = {
  title: "",
  slug: "",
  summary: "",
  body: "",
  author: "",
  published: false,
  publishedAt: "",
  categorySlugs: [],
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function toFormFromNews(n: News): FormState {
  return {
    title: n.title,
    slug: n.slug,
    summary: n.summary ?? "",
    body: n.body ?? "",
    author: n.author ?? "",
    published: n.published,
    publishedAt: n.publishedAt ? toLocalDateTimeInput(n.publishedAt) : "",
    categorySlugs: n.categories.map((c) => c.slug),
  };
}

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function AdminNewsManager() {
  const [news, setNews] = useState<News[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<News | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const hasSecret = Boolean(adminSecret);
  const hasApiBase = Boolean(apiBase);

  const refresh = useCallback(async () => {
    if (!hasSecret || !hasApiBase) return;
    setLoading(true);
    setError(null);
    try {
      const [list, cats] = await Promise.all([
        adminListNews(apiBase, adminSecret, { limit: 100 }),
        adminListCategories(apiBase, adminSecret),
      ]);
      setNews(list.news);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [hasApiBase, hasSecret]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm);
    setSaveMsg(null);
  };

  const startEdit = (n: News) => {
    setEditing(n);
    setCreating(false);
    setForm(toFormFromNews(n));
    setSaveMsg(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setCreating(false);
    setForm(emptyForm);
    setSaveMsg(null);
  };

  const toggleCategory = (slug: string) => {
    setForm((prev) => {
      const has = prev.categorySlugs.includes(slug);
      return {
        ...prev,
        categorySlugs: has
          ? prev.categorySlugs.filter((s) => s !== slug)
          : [...prev.categorySlugs, slug],
      };
    });
  };

  const save = async () => {
    if (!form.title.trim()) {
      setSaveMsg("El título es obligatorio");
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        summary: form.summary,
        body: form.body,
        author: form.author.trim() || null,
        published: form.published,
        publishedAt: fromLocalDateTimeInput(form.publishedAt),
        categorySlugs: form.categorySlugs,
      };
      let saved: News;
      if (editing) {
        saved = await adminUpdateNews(apiBase, adminSecret, editing.id, payload);
      } else {
        saved = await adminCreateNews(apiBase, adminSecret, payload);
      }
      setSaveMsg("Guardado");
      setEditing(saved);
      setCreating(false);
      setForm(toFormFromNews(saved));
      await refresh();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const removeNews = async (n: News) => {
    if (!window.confirm(`¿Eliminar la noticia "${n.title}"?`)) return;
    try {
      await adminDeleteNews(apiBase, adminSecret, n.id);
      if (editing?.id === n.id) {
        cancelEdit();
      }
      await refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const handleUpload = async (file: File) => {
    if (!editing) return;
    if (editing.images.length >= MAX_IMAGES) {
      setSaveMsg(`Máximo ${MAX_IMAGES} imágenes`);
      return;
    }
    setUploading(true);
    setSaveMsg(null);
    try {
      await adminUploadNewsImage(apiBase, adminSecret, editing.id, file, {
        setAsMain: editing.images.length === 0,
      });
      const fresh = (await adminListNews(apiBase, adminSecret, { limit: 100 })).news;
      setNews(fresh);
      const updated = fresh.find((n) => n.id === editing.id) ?? null;
      if (updated) setEditing(updated);
      setSaveMsg("Imagen subida");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  const setImageAsMain = async (imageId: string) => {
    if (!editing) return;
    try {
      const updated = await adminSetNewsImageMain(apiBase, adminSecret, editing.id, imageId);
      setEditing(updated);
      await refresh();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Error");
    }
  };

  const removeImage = async (imageId: string) => {
    if (!editing) return;
    if (!window.confirm("¿Eliminar esta imagen?")) return;
    try {
      const updated = await adminDeleteNewsImage(apiBase, adminSecret, editing.id, imageId);
      setEditing(updated);
      await refresh();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Error");
    }
  };

  const showForm = creating || editing !== null;

  const categoriesActive = useMemo(
    () => categories.filter((c) => c.active),
    [categories],
  );

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
        Falta configurar <code>PUBLIC_REPLAY_ADMIN_SECRET</code> en el frontend.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Noticias
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Creá, editá y publicá noticias. Cada noticia puede tener hasta {MAX_IMAGES} imágenes;
            la marcada como principal se usa como portada.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-2 bg-vj-green px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-sm transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Nueva noticia
        </button>
      </header>

      {error && (
        <p className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Listado ({news.length})
            </h3>
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
              disabled={loading}
            >
              {loading ? "Cargando…" : "Refrescar"}
            </button>
          </div>
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            {news.length === 0 && !loading && (
              <li className="px-2 py-4 text-sm text-slate-500">No hay noticias aún.</li>
            )}
            {news.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => startEdit(n)}
                  className={`flex w-full items-stretch gap-3 px-2 py-3 text-left transition hover:bg-slate-50 ${
                    editing?.id === n.id ? "bg-slate-100" : ""
                  }`}
                >
                  <div className="relative h-16 w-20 shrink-0 overflow-hidden bg-slate-100">
                    {n.mainImageUrl ? (
                      <img
                        src={n.mainImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 ${
                          n.published ? "bg-emerald-500" : "bg-amber-400"
                        }`}
                      />
                      <span className="line-clamp-1 text-sm font-extrabold text-slate-900">
                        {n.title}
                      </span>
                    </div>
                    <span className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                      {n.categories.length === 0
                        ? "Sin categoría"
                        : n.categories.map((c) => c.label).join(", ")}
                    </span>
                    <span className="mt-1 text-[11px] uppercase tracking-wider text-slate-400">
                      {n.published ? "Publicada" : "Borrador"} · {formatDate(n.publishedAt ?? n.createdAt)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-slate-200 bg-white p-4">
          {!showForm ? (
            <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center text-slate-500">
              <ImageIcon className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm">Elegí una noticia de la lista o creá una nueva.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Volver
                </button>
                <div className="flex items-center gap-2">
                  {editing && (
                    <button
                      type="button"
                      onClick={() => void removeNews(editing)}
                      className="inline-flex items-center gap-1.5 border border-rose-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 transition hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 bg-vj-green px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    {editing ? "Guardar" : "Crear"}
                  </button>
                </div>
              </div>

              {saveMsg && (
                <p className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  {saveMsg}
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Título *
                  </span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="mt-1 w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-vj-green focus:ring-2 focus:ring-vj-green/30"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Slug (URL)
                  </span>
                  <input
                    type="text"
                    placeholder="se-genera-desde-el-titulo"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="mt-1 w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-vj-green focus:ring-2 focus:ring-vj-green/30"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Copete / resumen
                </span>
                <textarea
                  rows={2}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  className="mt-1 w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-vj-green focus:ring-2 focus:ring-vj-green/30"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Cuerpo (separá párrafos con un renglón en blanco)
                </span>
                <textarea
                  rows={8}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="mt-1 w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-vj-green focus:ring-2 focus:ring-vj-green/30"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Autor (opcional)
                  </span>
                  <input
                    type="text"
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    className="mt-1 w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-vj-green focus:ring-2 focus:ring-vj-green/30"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Fecha de publicación
                  </span>
                  <input
                    type="datetime-local"
                    value={form.publishedAt}
                    onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
                    className="mt-1 w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-vj-green focus:ring-2 focus:ring-vj-green/30"
                  />
                </label>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm({ ...form, published: e.target.checked })}
                  className="h-4 w-4 border-slate-300 text-vj-green focus:ring-vj-green"
                />
                Publicada (visible en el sitio)
              </label>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Categorías (deportes)
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {categoriesActive.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No hay categorías activas.{" "}
                      <a href="/admin/noticias/categorias" className="underline">
                        Crear categorías
                      </a>
                      .
                    </p>
                  )}
                  {categoriesActive.map((c) => {
                    const active = form.categorySlugs.includes(c.slug);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleCategory(c.slug)}
                        className={`border px-3 py-1 text-xs font-bold uppercase tracking-wider transition ${
                          active
                            ? "border-vj-green bg-vj-green text-white"
                            : "border-slate-300 text-slate-700 hover:border-vj-green hover:text-vj-green"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {editing && (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Imágenes ({editing.images.length}/{MAX_IMAGES})
                    </span>
                    <label
                      className={`inline-flex cursor-pointer items-center gap-1.5 border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:border-vj-green hover:text-vj-green ${
                        editing.images.length >= MAX_IMAGES || uploading
                          ? "pointer-events-none opacity-50"
                          : ""
                      }`}
                    >
                      {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      Subir imagen
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={editing.images.length >= MAX_IMAGES || uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleUpload(file);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {editing.images.length === 0 ? (
                    <p className="mt-3 border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                      Subí al menos una imagen. La primera se marcará como principal.
                    </p>
                  ) : (
                    <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {editing.images.map((img) => (
                        <li
                          key={img.id}
                          className={`group relative overflow-hidden border ${
                            img.isMain ? "border-vj-green" : "border-slate-200"
                          }`}
                        >
                          <div className="aspect-square bg-slate-100">
                            <img
                              src={img.url}
                              alt={img.altText ?? ""}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          {img.isMain && (
                            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 bg-vj-green px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                              <Star className="h-3 w-3" /> Principal
                            </span>
                          )}
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-slate-900/85 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                            {!img.isMain ? (
                              <button
                                type="button"
                                onClick={() => void setImageAsMain(img.id)}
                                className="inline-flex items-center gap-1 hover:text-vj-green"
                                title="Marcar como principal"
                              >
                                <StarOff className="h-3 w-3" /> Hacer principal
                              </button>
                            ) : (
                              <span className="text-slate-300">Imagen de portada</span>
                            )}
                            <button
                              type="button"
                              onClick={() => void removeImage(img.id)}
                              className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-100"
                              title="Eliminar imagen"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
