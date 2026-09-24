/**
 * Tests del mapeo de heartbeat del recorder (panel admin).
 *
 * `mapHeartbeatRow` es pura: no toca Supabase ni la red.
 *
 * Ejecutar: node --import tsx --test src/services/recorder-heartbeat.service.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapHeartbeatRow, type RawJoin } from './recorder-heartbeat.service.js';

const NOW = Date.parse('2026-05-15T13:00:00.000Z');

type Heartbeat = NonNullable<RawJoin['recorder_heartbeat']>[number];

function secondsAgoIso(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString();
}

function makeRow(overrides: {
  slug?: string;
  label?: string | null;
  recordingEnabled?: boolean | null;
  heartbeat?: Partial<Heartbeat> | null;
}): RawJoin {
  const heartbeat =
    overrides.heartbeat === null
      ? null
      : [
          {
            last_seen_at: secondsAgoIso(5),
            status: 'recording',
            current_segment_match_key: null,
            current_segment_started_at: null,
            last_segment_match_key: null,
            last_segment_uploaded_at: null,
            bytes_written_last_segment: null,
            error_message: null,
            recorder_version: null,
            recorder_host: null,
            ...overrides.heartbeat,
          },
        ];

  return {
    slug: overrides.slug ?? 'cancha-padel',
    label: overrides.label ?? 'Cancha Pádel',
    recording_enabled:
      'recordingEnabled' in overrides ? (overrides.recordingEnabled ?? null) : true,
    recorder_heartbeat: heartbeat,
  };
}

describe('mapHeartbeatRow', () => {
  it('cancha grabando con heartbeat fresco: status recording y no stale', () => {
    const row = mapHeartbeatRow(makeRow({}), NOW);
    assert.equal(row.courtSlug, 'cancha-padel');
    assert.equal(row.courtLabel, 'Cancha Pádel');
    assert.equal(row.status, 'recording');
    assert.equal(row.stale, false);
    assert.equal(row.secondsSinceLastSeen, 5);
    assert.equal(row.recordingEnabled, true);
  });

  it('heartbeat viejo: marca stale', () => {
    const row = mapHeartbeatRow(makeRow({ heartbeat: { last_seen_at: secondsAgoIso(300) } }), NOW);
    assert.equal(row.status, 'recording');
    assert.equal(row.stale, true);
    assert.equal(row.secondsSinceLastSeen, 300);
  });

  it('mapea los campos nuevos de operación', () => {
    const row = mapHeartbeatRow(
      makeRow({
        heartbeat: {
          current_segment_match_key: 'cancha-padel|2026-05-15|13',
          current_segment_started_at: secondsAgoIso(60),
          last_segment_match_key: 'cancha-padel|2026-05-15|12',
          last_segment_uploaded_at: secondsAgoIso(30),
          bytes_written_last_segment: 123456789,
          recorder_version: '0.1.0',
          recorder_host: 'vps:recorder-1',
        },
      }),
      NOW,
    );
    assert.equal(row.currentSegmentMatchKey, 'cancha-padel|2026-05-15|13');
    assert.equal(row.currentSegmentStartedAt, secondsAgoIso(60));
    assert.equal(row.lastSegmentMatchKey, 'cancha-padel|2026-05-15|12');
    assert.equal(row.lastSegmentUploadedAt, secondsAgoIso(30));
    assert.equal(row.bytesWrittenLastSegment, 123456789);
    assert.equal(row.recorderVersion, '0.1.0');
    assert.equal(row.recorderHost, 'vps:recorder-1');
  });

  it('status error conserva el mensaje', () => {
    const row = mapHeartbeatRow(
      makeRow({ heartbeat: { status: 'error', error_message: 'ffmpeg salió con código 1' } }),
      NOW,
    );
    assert.equal(row.status, 'error');
    assert.equal(row.errorMessage, 'ffmpeg salió con código 1');
  });

  it('status idle', () => {
    const row = mapHeartbeatRow(makeRow({ heartbeat: { status: 'idle' } }), NOW);
    assert.equal(row.status, 'idle');
  });

  it('cancha habilitada sin heartbeat: unknown', () => {
    const row = mapHeartbeatRow(makeRow({ heartbeat: null, recordingEnabled: true }), NOW);
    assert.equal(row.status, 'unknown');
    assert.equal(row.lastSeenAt, null);
    assert.equal(row.secondsSinceLastSeen, null);
    assert.equal(row.stale, false);
  });

  it('cancha deshabilitada sin heartbeat: paused', () => {
    const row = mapHeartbeatRow(makeRow({ heartbeat: null, recordingEnabled: false }), NOW);
    assert.equal(row.status, 'paused');
  });

  it('status inválido cae a unknown', () => {
    const row = mapHeartbeatRow(makeRow({ heartbeat: { status: 'raro' } }), NOW);
    assert.equal(row.status, 'unknown');
  });

  it('recording_enabled null se interpreta como deshabilitada', () => {
    const row = mapHeartbeatRow(makeRow({ heartbeat: null, recordingEnabled: null }), NOW);
    assert.equal(row.recordingEnabled, false);
    assert.equal(row.status, 'paused');
  });
});
