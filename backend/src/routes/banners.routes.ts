import { Router } from 'express';
import multer from 'multer';
import {
  adminCreateBanner,
  adminDeleteBanner,
  adminListBanners,
  adminUpdateBanner,
  adminUploadBannerImage,
  getPublicBanners,
} from '../controllers/banners.controller.js';
import { requireAdminSecret } from '../middleware/require-admin-secret.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

export const bannersRouter = Router();

// Público
bannersRouter.get('/', getPublicBanners);

// Admin
bannersRouter.get('/admin/list', requireAdminSecret, adminListBanners);
bannersRouter.post('/admin', requireAdminSecret, adminCreateBanner);
bannersRouter.patch('/admin/:id', requireAdminSecret, adminUpdateBanner);
bannersRouter.delete('/admin/:id', requireAdminSecret, adminDeleteBanner);
bannersRouter.post(
  '/admin/:id/image',
  requireAdminSecret,
  upload.single('image'),
  adminUploadBannerImage,
);
