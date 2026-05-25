import { normalizeReplayApiBase } from "./replay-api-base";

export type NewsCategory = {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
  active: boolean;
};

export type NewsImage = {
  id: string;
  url: string;
  key: string | null;
  isMain: boolean;
  sortOrder: number;
  altText: string | null;
};

export type News = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  author: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  categories: NewsCategory[];
  images: NewsImage[];
  mainImageUrl: string | null;
};

const PLACEHOLDER = "/images/deportes/placeholder.svg";

export function getNewsApiBase(): string {
  return normalizeReplayApiBase(import.meta.env.PUBLIC_REPLAY_API_BASE ?? "");
}

async function getJson<T>(
  base: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${base}${path}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export type ListNewsOptions = {
  categorySlug?: string;
  limit?: number;
  page?: number;
  search?: string;
};

export async function fetchPublicNews(
  apiBase: string,
  opts: ListNewsOptions = {},
): Promise<{ news: News[]; total: number }> {
  if (!apiBase) return { news: [], total: 0 };
  const params = new URLSearchParams();
  if (opts.categorySlug) params.set("category", opts.categorySlug);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.page) params.set("page", String(opts.page));
  if (opts.search) params.set("q", opts.search);
  const qs = params.toString();
  try {
    return await getJson<{ news: News[]; total: number }>(
      apiBase,
      `/api/news${qs ? `?${qs}` : ""}`,
    );
  } catch (err) {
    console.warn("[news-api] fetchPublicNews", err);
    return { news: [], total: 0 };
  }
}

export async function fetchPublicNewsBySlug(
  apiBase: string,
  slug: string,
): Promise<News | null> {
  if (!apiBase) return null;
  try {
    const res = await getJson<{ news: News }>(
      apiBase,
      `/api/news/${encodeURIComponent(slug)}`,
    );
    return res.news ?? null;
  } catch (err) {
    console.warn("[news-api] fetchPublicNewsBySlug", err);
    return null;
  }
}

export async function fetchPublicCategories(apiBase: string): Promise<NewsCategory[]> {
  if (!apiBase) return [];
  try {
    const res = await getJson<{ categories: NewsCategory[] }>(
      apiBase,
      `/api/news/categories`,
    );
    return res.categories ?? [];
  } catch (err) {
    console.warn("[news-api] fetchPublicCategories", err);
    return [];
  }
}

export function newsImageOrPlaceholder(n: News | null | undefined): string {
  return n?.mainImageUrl ?? PLACEHOLDER;
}

export function newsDate(n: News | { publishedAt: string | null; createdAt: string }): string {
  const iso = n.publishedAt ?? n.createdAt;
  if (!iso) return "—/—/——";
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function newsCategoryLabel(n: News): string {
  if (n.categories.length === 0) return "Institucional";
  return n.categories.map((c) => c.label).join(" · ");
}

export function newsHref(n: News): string {
  return `/noticias/${n.slug}`;
}

/** Cantidad de noticias por página en /noticias. */
export const NEWS_PAGE_SIZE = 6;

/** Vista previa en páginas de deportes. */
export const NEWS_DEPORTE_PREVIEW_SIZE = 3;

export function noticiasListHref(opts: {
  categorySlug?: string;
  search?: string;
  page?: number;
} = {}): string {
  const params = new URLSearchParams();
  if (opts.categorySlug) params.set("categoria", opts.categorySlug);
  if (opts.search) params.set("q", opts.search);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  const qs = params.toString();
  return `/noticias${qs ? `?${qs}` : ""}`;
}

// ---------------------------------------------------------------------------
// Admin (browser)
// ---------------------------------------------------------------------------

export type AdminNewsUpsertInput = {
  title: string;
  slug?: string;
  summary?: string;
  body?: string;
  author?: string | null;
  published?: boolean;
  publishedAt?: string | null;
  categorySlugs?: string[];
};

async function adminFetch<T>(
  apiBase: string,
  adminSecret: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!apiBase) throw new Error("Falta PUBLIC_REPLAY_API_BASE");
  if (!adminSecret) throw new Error("Falta PUBLIC_REPLAY_ADMIN_SECRET");
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "x-admin-secret": adminSecret,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      msg = j.error ?? text;
    } catch {
      // raw text
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function adminListNews(
  apiBase: string,
  adminSecret: string,
  opts: ListNewsOptions = {},
): Promise<{ news: News[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.categorySlug) params.set("category", opts.categorySlug);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.page) params.set("page", String(opts.page));
  if (opts.search) params.set("q", opts.search);
  const qs = params.toString();
  return adminFetch<{ news: News[]; total: number }>(
    apiBase,
    adminSecret,
    `/api/news/admin/list${qs ? `?${qs}` : ""}`,
  );
}

export async function adminCreateNews(
  apiBase: string,
  adminSecret: string,
  input: AdminNewsUpsertInput,
): Promise<News> {
  const res = await adminFetch<{ news: News }>(apiBase, adminSecret, `/api/news/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.news;
}

export async function adminUpdateNews(
  apiBase: string,
  adminSecret: string,
  id: string,
  input: Partial<AdminNewsUpsertInput>,
): Promise<News> {
  const res = await adminFetch<{ news: News }>(apiBase, adminSecret, `/api/news/admin/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.news;
}

export async function adminDeleteNews(
  apiBase: string,
  adminSecret: string,
  id: string,
): Promise<void> {
  await adminFetch<void>(apiBase, adminSecret, `/api/news/admin/${id}`, { method: "DELETE" });
}

export async function adminUploadNewsImage(
  apiBase: string,
  adminSecret: string,
  newsId: string,
  file: File,
  opts: { setAsMain?: boolean; altText?: string } = {},
): Promise<NewsImage> {
  const form = new FormData();
  form.append("image", file);
  if (opts.setAsMain) form.append("setAsMain", "true");
  if (opts.altText) form.append("altText", opts.altText);
  const res = await fetch(`${apiBase}/api/news/admin/${newsId}/images`, {
    method: "POST",
    headers: { "x-admin-secret": adminSecret },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      msg = j.error ?? text;
    } catch {
      // raw
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const json = (await res.json()) as { image: NewsImage };
  return json.image;
}

export async function adminSetNewsImageMain(
  apiBase: string,
  adminSecret: string,
  newsId: string,
  imageId: string,
): Promise<News> {
  const res = await adminFetch<{ news: News }>(
    apiBase,
    adminSecret,
    `/api/news/admin/${newsId}/images/${imageId}/main`,
    { method: "PATCH" },
  );
  return res.news;
}

export async function adminDeleteNewsImage(
  apiBase: string,
  adminSecret: string,
  newsId: string,
  imageId: string,
): Promise<News> {
  const res = await adminFetch<{ news: News }>(
    apiBase,
    adminSecret,
    `/api/news/admin/${newsId}/images/${imageId}`,
    { method: "DELETE" },
  );
  return res.news;
}

export async function adminListCategories(
  apiBase: string,
  adminSecret: string,
): Promise<NewsCategory[]> {
  const res = await adminFetch<{ categories: NewsCategory[] }>(
    apiBase,
    adminSecret,
    `/api/news/admin/categories`,
  );
  return res.categories ?? [];
}

export async function adminReplaceCategories(
  apiBase: string,
  adminSecret: string,
  categories: { slug: string; label: string; sortOrder?: number; active?: boolean }[],
): Promise<NewsCategory[]> {
  const res = await adminFetch<{ categories: NewsCategory[] }>(
    apiBase,
    adminSecret,
    `/api/news/admin/categories`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories }),
    },
  );
  return res.categories ?? [];
}
