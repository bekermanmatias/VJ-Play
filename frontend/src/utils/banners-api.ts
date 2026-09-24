import { normalizeReplayApiBase } from "./replay-api-base";
import { adminFetchJson } from "./admin-api";

export type HomeBanner = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  buttonLabel: string;
  buttonUrl: string;
  openInNewTab: boolean;
  imageUrl: string;
  imageKey: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type BannerUpsertInput = {
  title: string;
  subtitle?: string;
  description?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  openInNewTab?: boolean;
  active?: boolean;
  sortOrder?: number;
};

export function getBannersApiBase(): string {
  return normalizeReplayApiBase(import.meta.env.PUBLIC_REPLAY_API_BASE ?? "");
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

// Público
export async function fetchPublicBanners(base: string): Promise<HomeBanner[]> {
  const data = await getJson<{ banners: HomeBanner[] }>(`${base}/api/banners`);
  return data.banners;
}

// Admin (browser → proxy same-origin /admin/api)
export async function adminListBanners(): Promise<HomeBanner[]> {
  const data = await adminFetchJson<{ banners: HomeBanner[] }>(`/banners/admin/list`);
  return data.banners;
}

export async function adminCreateBanner(input: BannerUpsertInput): Promise<HomeBanner> {
  const data = await adminFetchJson<{ banner: HomeBanner }>(`/banners/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.banner;
}

export async function adminUpdateBanner(
  id: string,
  input: Partial<BannerUpsertInput>,
): Promise<HomeBanner> {
  const data = await adminFetchJson<{ banner: HomeBanner }>(`/banners/admin/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.banner;
}

export async function adminDeleteBanner(id: string): Promise<void> {
  await adminFetchJson<void>(`/banners/admin/${id}`, { method: "DELETE" });
}

export async function adminUploadBannerImage(id: string, file: File): Promise<HomeBanner> {
  const form = new FormData();
  form.append("image", file);
  const data = await adminFetchJson<{ banner: HomeBanner }>(`/banners/admin/${id}/image`, {
    method: "POST",
    body: form,
  });
  return data.banner;
}
