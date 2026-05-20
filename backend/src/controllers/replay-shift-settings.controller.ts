import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  getReplayShiftConfig,
  upsertReplayShiftConfig,
} from '../services/replay-shift-settings.service.js';

export const getShiftConfig = asyncHandler(async (_req: Request, res: Response) => {
  const config = await getReplayShiftConfig();
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json(config);
});

export const putShiftConfig = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    shiftDurationSeconds?: unknown;
    windowStartHour?: unknown;
    windowEndHour?: unknown;
  };

  const shiftDurationSeconds = Number(body.shiftDurationSeconds);
  const windowStartHour = Number(body.windowStartHour);
  const windowEndHour = Number(body.windowEndHour);

  const config = await upsertReplayShiftConfig({
    shiftDurationSeconds,
    windowStartHour,
    windowEndHour,
  });

  res.json(config);
});
