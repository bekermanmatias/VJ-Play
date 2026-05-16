import { env } from '../config/env.js';
import { HttpError } from '../errors/http-error.js';
import type { CourtDvrRow } from './replay-courts-dvr.service.js';

export function isDvrConfigured(): boolean {
  const d = env.dvr;
  return !!(d.user && d.password && d.host);
}

export function maskRtspUrl(url: string): string {
  return url.replace(/:([^:@/]+)@/, ':***@');
}

export function resolveCourtRtspUrl(court: CourtDvrRow): string {
  const override = court.rtspUrlOverride?.trim();
  if (override) {
    if (!/^rtsp:\/\//i.test(override)) {
      throw new HttpError(400, 'rtsp_url_override debe empezar con rtsp://');
    }
    return override;
  }

  if (court.dvrChannel === null || Number.isNaN(court.dvrChannel)) {
    throw new HttpError(
      400,
      `La cancha "${court.slug}" no tiene canal DVR ni URL RTSP override`,
    );
  }

  if (!isDvrConfigured()) {
    throw new HttpError(
      503,
      'DVR no configurado en backend (.env: DVR_HOST, DVR_RTSP_USER, DVR_RTSP_PASSWORD)',
    );
  }

  const d = env.dvr;
  return d.urlTemplate
    .replace('{user}', encodeURIComponent(d.user!))
    .replace('{password}', encodeURIComponent(d.password!))
    .replace('{host}', d.host!)
    .replace('{port}', String(d.port))
    .replace('{channel}', String(court.dvrChannel))
    .replace('{subtype}', String(court.dvrSubtype ?? 0));
}
