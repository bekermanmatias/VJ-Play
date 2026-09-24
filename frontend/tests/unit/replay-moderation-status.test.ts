import { describe, expect, it } from "vitest";

import {
  deriveReplayAssetStatus,
  describeReplayAssetStatus,
  formatReplayDateTime,
} from "@/utils/replay-moderation-status";

describe("deriveReplayAssetStatus", () => {
  it("sin video = MISSING", () => {
    expect(deriveReplayAssetStatus({ videoUrl: null, code: "ABC123", videoUpdatedAt: null })).toBe(
      "MISSING",
    );
  });

  it("video vacío = MISSING", () => {
    expect(deriveReplayAssetStatus({ videoUrl: "   ", code: "ABC123", videoUpdatedAt: null })).toBe(
      "MISSING",
    );
  });

  it("video sin código = PROCESSING", () => {
    expect(
      deriveReplayAssetStatus({ videoUrl: "https://r2/x.mp4", code: null, videoUpdatedAt: null }),
    ).toBe("PROCESSING");
  });

  it("código vacío = PROCESSING", () => {
    expect(
      deriveReplayAssetStatus({ videoUrl: "https://r2/x.mp4", code: "", videoUpdatedAt: null }),
    ).toBe("PROCESSING");
  });

  it("video y código = READY", () => {
    expect(
      deriveReplayAssetStatus({
        videoUrl: "https://r2/x.mp4",
        code: "ABC123",
        videoUpdatedAt: "2026-05-24T17:05:00.000Z",
      }),
    ).toBe("READY");
  });
});

describe("describeReplayAssetStatus", () => {
  it("READY", () => {
    expect(describeReplayAssetStatus("READY")).toEqual({
      label: "LISTO",
      tone: "ok",
      hint: expect.any(String),
    });
  });

  it("PROCESSING", () => {
    const d = describeReplayAssetStatus("PROCESSING");
    expect(d.label).toBe("PROCESANDO");
    expect(d.tone).toBe("warn");
  });

  it("MISSING", () => {
    const d = describeReplayAssetStatus("MISSING");
    expect(d.label).toBe("SIN VIDEO");
    expect(d.tone).toBe("error");
  });
});

describe("formatReplayDateTime", () => {
  it("vacío = guion", () => {
    expect(formatReplayDateTime(null)).toBe("—");
    expect(formatReplayDateTime(undefined)).toBe("—");
    expect(formatReplayDateTime("")).toBe("—");
  });

  it("fecha inválida = guion", () => {
    expect(formatReplayDateTime("no-es-fecha")).toBe("—");
  });

  it("fecha válida en formato es-AR", () => {
    const out = formatReplayDateTime("2026-05-24T17:05:00.000Z");
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/);
  });
});
