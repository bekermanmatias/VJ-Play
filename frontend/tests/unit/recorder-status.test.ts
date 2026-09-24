import { describe, expect, it } from "vitest";

import {
  describeRecorderBadge,
  describeRecorderIssue,
  formatBytes,
  formatDuration,
  formatRelativeSeconds,
  type RecorderStatusView,
} from "@/utils/recorder-status";

function makeView(overrides: Partial<RecorderStatusView> = {}): RecorderStatusView {
  return {
    status: "recording",
    stale: false,
    recordingEnabled: true,
    lastSeenAt: "2026-05-15T13:00:00.000Z",
    secondsSinceLastSeen: 5,
    currentSegmentStartedAt: null,
    currentSegmentMatchKey: null,
    lastSegmentMatchKey: null,
    lastSegmentUploadedAt: null,
    bytesWrittenLastSegment: null,
    errorMessage: null,
    recorderVersion: "0.1.0",
    recorderHost: "vps:recorder-1",
    ...overrides,
  };
}

describe("describeRecorderBadge", () => {
  it("loading muestra spinner", () => {
    const badge = describeRecorderBadge(undefined, true);
    expect(badge.tone).toBe("muted");
    expect(badge.spin).toBe(true);
  });

  it("sin datos", () => {
    expect(describeRecorderBadge(undefined).label).toBe("Sin datos");
  });

  it("grabando ok", () => {
    const badge = describeRecorderBadge(makeView({ status: "recording", stale: false }));
    expect(badge).toEqual({ label: "recording", tone: "ok" });
  });

  it("grabando pero stale", () => {
    const badge = describeRecorderBadge(makeView({ status: "recording", stale: true }));
    expect(badge.tone).toBe("warn");
    expect(badge.label).toContain("stale");
  });

  it("error", () => {
    expect(describeRecorderBadge(makeView({ status: "error" }))).toEqual({
      label: "error",
      tone: "error",
    });
  });

  it("idle = fuera de horario", () => {
    expect(describeRecorderBadge(makeView({ status: "idle" }))).toEqual({
      label: "fuera de horario",
      tone: "idle",
    });
  });

  it("paused = deshabilitada", () => {
    expect(describeRecorderBadge(makeView({ status: "paused" }))).toEqual({
      label: "deshabilitada",
      tone: "muted",
    });
  });

  it("starting = arrancando", () => {
    const badge = describeRecorderBadge(makeView({ status: "starting" }));
    expect(badge.label).toBe("arrancando");
    expect(badge.spin).toBe(true);
  });

  it("unknown = sin reportar", () => {
    expect(describeRecorderBadge(makeView({ status: "unknown" }))).toEqual({
      label: "sin reportar",
      tone: "warn",
    });
  });
});

describe("describeRecorderIssue", () => {
  it("estado normal no genera issue", () => {
    expect(describeRecorderIssue(makeView())).toBeNull();
  });

  it("sin datos no genera issue", () => {
    expect(describeRecorderIssue(undefined)).toBeNull();
  });

  it("clasifica error RTSP", () => {
    const issue = describeRecorderIssue(
      makeView({ status: "error", errorMessage: "Connection timed out to rtsp://host" }),
    );
    expect(issue?.title).toBe("Error de conexión RTSP");
    expect(issue?.action).toBeTruthy();
  });

  it("clasifica error de ffmpeg", () => {
    const issue = describeRecorderIssue(
      makeView({ status: "error", errorMessage: "No se pudo lanzar ffmpeg (ENOENT)" }),
    );
    expect(issue?.title).toBe("No se pudo iniciar FFmpeg");
  });

  it("clasifica error de upload a R2", () => {
    const issue = describeRecorderIssue(
      makeView({ status: "error", errorMessage: "Error subiendo segmento a R2: timeout" }),
    );
    expect(issue?.title).toBe("Error subiendo el segmento");
  });

  it("error genérico", () => {
    const issue = describeRecorderIssue(
      makeView({ status: "error", errorMessage: "algo raro pasó" }),
    );
    expect(issue?.title).toBe("Error del recorder");
  });

  it("error sin mensaje", () => {
    const issue = describeRecorderIssue(makeView({ status: "error", errorMessage: null }));
    expect(issue?.title).toBe("Error del recorder");
  });

  it("unknown = recorder sin heartbeat", () => {
    const issue = describeRecorderIssue(makeView({ status: "unknown", lastSeenAt: null }));
    expect(issue?.title).toBe("Recorder sin heartbeat");
  });

  it("stale = recorder sin reportar", () => {
    const issue = describeRecorderIssue(
      makeView({ status: "recording", stale: true, secondsSinceLastSeen: 300 }),
    );
    expect(issue?.title).toBe("Recorder sin reportar");
    expect(issue?.detail).toContain("hace 5 min");
  });

  it("idle no genera issue (fuera de horario es normal)", () => {
    expect(describeRecorderIssue(makeView({ status: "idle" }))).toBeNull();
  });
});

describe("formatDuration", () => {
  it("segundos", () => {
    expect(formatDuration(45)).toBe("45 s");
  });
  it("minutos", () => {
    expect(formatDuration(12 * 60)).toBe("12 min");
  });
  it("horas exactas", () => {
    expect(formatDuration(2 * 3600)).toBe("2 h");
  });
  it("horas y minutos", () => {
    expect(formatDuration(80 * 60)).toBe("1 h 20 min");
  });
  it("negativos se normalizan a 0", () => {
    expect(formatDuration(-5)).toBe("0 s");
  });
});

describe("formatRelativeSeconds", () => {
  it("null = nunca", () => {
    expect(formatRelativeSeconds(null)).toBe("nunca");
  });
  it("valor", () => {
    expect(formatRelativeSeconds(90)).toBe("hace 1 min");
  });
});

describe("formatBytes", () => {
  it("null = guion", () => {
    expect(formatBytes(null)).toBe("—");
  });
  it("bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });
  it("megabytes con coma decimal", () => {
    expect(formatBytes(12.3 * 1024 * 1024)).toBe("12,3 MB");
  });
  it("gigabytes", () => {
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1,5 GB");
  });
  it("valor inválido", () => {
    expect(formatBytes(Number.NaN)).toBe("—");
  });
});
