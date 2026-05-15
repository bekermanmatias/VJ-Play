import { Router } from 'express';
import {
  deleteReplayAccessClip,
  getReplayAccessClipDownload,
  getReplayAccessFullVideoDownloadPrepare,
  getReplayAccessFullVideoDownloadUrl,
  getReplayAccessFullVideoWatermarkedStream,
  getReplayAdminMatches,
  getReplayAccessClips,
  getReplayAccessExists,
  getReplayAccessMatchById,
  getReplayAccessStream,
  patchReplayAccessClip,
  postReplayAccessCodes,
  postReplayAccessVerify,
} from '../controllers/replay-access.controller.js';
import {
  getCourts,
  putCourts,
} from '../controllers/replay-courts.controller.js';
import {
  getCourtsDvr,
  getRecorderStatus,
  patchCourtDvr,
} from '../controllers/recorder-admin.controller.js';
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
replaysRouter.get('/access/full-video/download-url', getReplayAccessFullVideoDownloadUrl);
replaysRouter.get('/access/full-video/download-prepare', getReplayAccessFullVideoDownloadPrepare);
replaysRouter.get('/access/full-video/watermarked-stream', getReplayAccessFullVideoWatermarkedStream);
replaysRouter.get('/access/clips', getReplayAccessClips);
replaysRouter.get('/access/clips/:clipId/download', getReplayAccessClipDownload);
replaysRouter.patch('/access/clips/:clipId', patchReplayAccessClip);
replaysRouter.delete('/access/clips/:clipId', deleteReplayAccessClip);
replaysRouter.post('/access/codes', requireAdminSecret, postReplayAccessCodes);
replaysRouter.get('/admin/matches', requireAdminSecret, getReplayAdminMatches);

replaysRouter.get('/admin/courts-dvr', requireAdminSecret, getCourtsDvr);
replaysRouter.patch('/admin/courts-dvr/:slug', requireAdminSecret, patchCourtDvr);
replaysRouter.get('/admin/recorder-status', requireAdminSecret, getRecorderStatus);
