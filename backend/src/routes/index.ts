import { Router } from 'express';
import { bannersRouter } from './banners.routes.js';
import { courtsRouter } from './courts.routes.js';
import { newsRouter } from './news.routes.js';
import { replaysRouter } from './replays.routes.js';
import { videosRouter } from './videos.routes.js';

export const apiRouter = Router();

apiRouter.use('/banners', bannersRouter);
apiRouter.use('/courts', courtsRouter);
apiRouter.use('/videos', videosRouter);
apiRouter.use('/replays', replaysRouter);
apiRouter.use('/news', newsRouter);
