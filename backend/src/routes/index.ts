import { Router } from 'express';
import { courtsRouter } from './courts.routes.js';
import { replaysRouter } from './replays.routes.js';
import { videosRouter } from './videos.routes.js';

export const apiRouter = Router();

apiRouter.use('/courts', courtsRouter);
apiRouter.use('/videos', videosRouter);
apiRouter.use('/replays', replaysRouter);
