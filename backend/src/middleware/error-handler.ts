import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../errors/http-error.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Error interno';
  console.error('[error]', err);
  res.status(500).json({
    error:
      process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : message,
  });
};
