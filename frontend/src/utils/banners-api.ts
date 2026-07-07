import { normalizeReplayApiBase } from "./replay-api-base";

export type HomeBanner = {
  id: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonUrl: string;
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
  buttonLabel?: string;
  buttonUrl?: string;
  active?: boolean;
  sortOrder?: number;
};

export function getBannersApiBase(): string {
  return normalizeReplayApiBase(import.meta.env.PUBLIC_REPLAY_API_BASE ?? "");
}

function adminHeaders(secret: string): HeadersInit {
  return { "Content-Type": "application/json", "x-admin-secret": secret };
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

// Admin
export async function adminListBanners(base: string, secret: string): Promise<HomeBanner[]> {
  const data = await getJson<{ banners: HomeBanner[] }>(
    `${base}/api/banners/admin/list`,
    { headers: { "x-admin-secret": secret } },
  );
  return data.banners;
}

export async function adminCreateBanner(
  base: string,
  secret: string,
  input: BannerUpsertInput,
): Promise<HomeBanner> {
  const data = await getJson<{ banner: HomeBanner }>(`${base}/api/banners/admin`, {
    method: "POST",
    headers: adminHeaders(secret),
    body: JSON.stringify(input),
  });
  return data.banner;
}

export async function adminUpdateBanner(
  base: string,
  secret: string,
  id: string,
  input: Partial<BannerUpsertInput>,
): Promise<HomeBanner> {
  const data = await getJson<{ banner: HomeBanner }>(`${base}/api/banners/admin/${id}`, {
    method: "PATCH",
    headers: adminHeaders(secret),
    body: JSON.stringify(input),
  });
  return data.banner;
}

export async function adminDeleteBanner(
  base: string,
  secret: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${base}/api/banners/admin/${id}`, {
    method: "DELETE",
    headers: { "x-admin-secret": secret },
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export async function adminUploadBannerImage(
  base: string,
  secret: string,
  id: string,
  file: File,
): Promise<HomeBanner> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${base}/api/banners/admin/${id}/image`, {
    method: "POST",
    headers: { "x-admin-secret": secret },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { banner: HomeBanner };
  return data.banner;
}
