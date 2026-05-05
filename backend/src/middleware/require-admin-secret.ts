import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../errors/http-error.js';

export function requireAdminSecret(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!env.adminSecret) {
    next(new HttpError(503, 'Operación administrativa no disponible'));
    return;
  }
  const got = req.header('x-admin-secret');
  if (got !== env.adminSecret) {
    next(new HttpError(401, 'No autorizado'));
    return;
  }
  next();
}
