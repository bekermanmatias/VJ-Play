import { Router } from 'express';
import multer from 'multer';
import {
  adminCreateNews,
  adminDeleteNews,
  adminDeleteNewsImage,
  adminGetNews,
  adminListCategories,
  adminListNews,
  adminReplaceCategories,
  adminSetNewsImageMain,
  adminUpdateNews,
  adminUploadNewsImage,
  getNewsCategoriesPublic,
  getNewsDetail,
  getNewsList,
} from '../controllers/news.controller.js';
import { requireAdminSecret } from '../middleware/require-admin-secret.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

export const newsRouter = Router();

// Público
newsRouter.get('/', getNewsList);
newsRouter.get('/categories', getNewsCategoriesPublic);
newsRouter.get('/:slug', getNewsDetail);

// Admin
newsRouter.get('/admin/categories', requireAdminSecret, adminListCategories);
newsRouter.put('/admin/categories', requireAdminSecret, adminReplaceCategories);

newsRouter.get('/admin/list', requireAdminSecret, adminListNews);
newsRouter.post('/admin', requireAdminSecret, adminCreateNews);
newsRouter.get('/admin/:id', requireAdminSecret, adminGetNews);
newsRouter.patch('/admin/:id', requireAdminSecret, adminUpdateNews);
newsRouter.delete('/admin/:id', requireAdminSecret, adminDeleteNews);

newsRouter.post(
  '/admin/:id/images',
  requireAdminSecret,
  upload.single('image'),
  adminUploadNewsImage,
);
newsRouter.patch('/admin/:id/images/:imageId/main', requireAdminSecret, adminSetNewsImageMain);
newsRouter.delete('/admin/:id/images/:imageId', requireAdminSecret, adminDeleteNewsImage);
