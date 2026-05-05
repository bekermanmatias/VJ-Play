import { Router } from 'express';
import { postCourtSnap } from '../controllers/courts.controller.js';

export const courtsRouter = Router();

courtsRouter.post('/:court_id/snap', postCourtSnap);
