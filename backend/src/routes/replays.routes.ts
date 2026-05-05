import { Router } from 'express';
import {
  getReplayAccessStream,
  postReplayAccessCodes,
  postReplayAccessVerify,
} from '../controllers/replay-access.controller.js';
import { requireAdminSecret } from '../middleware/require-admin-secret.js';

export const replaysRouter = Router();

replaysRouter.post('/access/verify', postReplayAccessVerify);
replaysRouter.get('/access/stream', getReplayAccessStream);
replaysRouter.post('/access/codes', requireAdminSecret, postReplayAccessCodes);
