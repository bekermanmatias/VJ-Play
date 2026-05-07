import { Router } from 'express';
import {
  getReplayAccessStream,
  postReplayAccessCodes,
  postReplayAccessVerify,
} from '../controllers/replay-access.controller.js';
import {
  getCourts,
  putCourts,
} from '../controllers/replay-courts.controller.js';
import {
  getShiftConfig,
  putShiftConfig,
} from '../controllers/replay-shift-settings.controller.js';
import { requireAdminSecret } from '../middleware/require-admin-secret.js';

export const replaysRouter = Router();

replaysRouter.get('/shift-config', getShiftConfig);
replaysRouter.put('/shift-config', requireAdminSecret, putShiftConfig);

replaysRouter.get('/courts', getCourts);
replaysRouter.put('/courts', requireAdminSecret, putCourts);

replaysRouter.post('/access/verify', postReplayAccessVerify);
replaysRouter.get('/access/stream', getReplayAccessStream);
replaysRouter.post('/access/codes', requireAdminSecret, postReplayAccessCodes);
