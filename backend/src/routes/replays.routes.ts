import { Router } from 'express';
import {
  getReplayAdminMatches,
  getReplayAccessClips,
  getReplayAccessExists,
  getReplayAccessMatchById,
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
replaysRouter.get('/access/exists', getReplayAccessExists);
replaysRouter.get('/access/match-by-id', getReplayAccessMatchById);
replaysRouter.get('/access/stream', getReplayAccessStream);
replaysRouter.get('/access/clips', getReplayAccessClips);
replaysRouter.post('/access/codes', requireAdminSecret, postReplayAccessCodes);
replaysRouter.get('/admin/matches', requireAdminSecret, getReplayAdminMatches);
