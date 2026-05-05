import { Router } from 'express';
import { getVideoClipJob, postVideoClip } from '../controllers/videos.controller.js';

export const videosRouter = Router();

videosRouter.post('/clip', postVideoClip);
videosRouter.get('/clip/:jobId', getVideoClipJob);
