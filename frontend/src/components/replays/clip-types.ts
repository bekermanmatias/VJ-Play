import { matchKeyToDownloadFileStem } from "@/utils/replay-download-filename";

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

export function replayClipDownloadFilename(
  clip: Pick<ReplayClipItem, "id" | "label">,
  matchKey?: string,
): string {
  const labelPart =
    clip.label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "clip";
  if (!matchKey?.trim()) {
    return `clip-${clip.id}-${labelPart}.mp4`;
  }
  const stem = matchKeyToDownloadFileStem(matchKey);
  return `${labelPart}-${stem}.mp4`;
}
