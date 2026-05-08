export type ReplayClipStatus = "processing" | "ready" | "failed";

export type ReplayClipItem = {
  id: string;
  label: string;
  at: number;
  endAt?: number;
  thumb: string;
  downloadHref?: string;
  durationSeconds?: number;
  clipSizeBytes?: number | null;
  status?: ReplayClipStatus;
  error?: string | null;
};
