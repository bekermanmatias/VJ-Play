export type ClipJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ClipJobRecord {
  id: string;
  status: ClipJobStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
  resultKey?: string;
  publicUrl?: string;
}

const jobs = new Map<string, ClipJobRecord>();

function nowIso(): string {
  return new Date().toISOString();
}

export function createClipJob(jobId: string): void {
  const t = nowIso();
  jobs.set(jobId, {
    id: jobId,
    status: 'queued',
    createdAt: t,
    updatedAt: t,
  });
}

export function startClipJob(jobId: string): void {
  const row = jobs.get(jobId);
  if (!row) {
    return;
  }
  row.status = 'processing';
  row.updatedAt = nowIso();
}

export function succeedClipJob(
  jobId: string,
  result: { resultKey: string; publicUrl?: string },
): void {
  const row = jobs.get(jobId);
  if (!row) {
    return;
  }
  row.status = 'completed';
  row.resultKey = result.resultKey;
  row.publicUrl = result.publicUrl;
  row.updatedAt = nowIso();
}

export function failClipJob(jobId: string, error: string): void {
  const row = jobs.get(jobId);
  if (!row) {
    return;
  }
  row.status = 'failed';
  row.error = error;
  row.updatedAt = nowIso();
}

export function getClipJob(jobId: string): ClipJobRecord | undefined {
  return jobs.get(jobId);
}
