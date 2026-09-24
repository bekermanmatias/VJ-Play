import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../errors/http-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  createPaymentPreference,
  getPaymentStatus,
  isValidWebhookSignature,
  issueSessionFromAccessToken,
  processPaymentWebhook,
} from '../services/replay-payment.service.js';

/**
 * POST /api/replays/payment/create-preference
 * Body: { matchKey: string }
 * Crea una preferencia de Mercado Pago y retorna el link de checkout.
 */
export const postPaymentCreatePreference = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { matchKey?: unknown };
  const matchKey = typeof body.matchKey === 'string' ? body.matchKey : '';
  if (!matchKey) {
    throw new HttpError(400, 'matchKey es requerido');
  }
  const result = await createPaymentPreference({ matchKey });
  res.json(result);
});

/**
 * POST /api/replays/payment/webhook
 * Notificación de Mercado Pago.
 * Acepta tanto el formato topic/id (IPN) como el formato JSON (webhooks v2).
 * Valida `x-signature` antes de procesar: firma inválida → 401 y no se toca ningún pago.
 */
export const postPaymentWebhook = asyncHandler(async (req: Request, res: Response) => {
  // Formato webhook v2 (JSON body): { type: "payment", data: { id: "..." } }
  const jsonBody = req.body as { type?: unknown; data?: { id?: unknown }; action?: unknown } | null;
  const queryType = typeof req.query.type === 'string' ? req.query.type : '';
  const queryId = typeof req.query['data.id'] === 'string' ? req.query['data.id'] : '';

  let type = '';
  let dataId = '';

  if (jsonBody?.data?.id) {
    // Webhook v2 format
    type = typeof jsonBody.type === 'string' ? jsonBody.type : 'payment';
    dataId = String(jsonBody.data.id);
  } else if (queryType && queryId) {
    // IPN format (query params)
    type = queryType;
    dataId = queryId;
  } else if (typeof jsonBody?.action === 'string' && jsonBody.action.includes('payment')) {
    // Alternative webhook format
    type = 'payment';
    const idFromBody = (jsonBody as { data?: { id?: unknown } }).data?.id;
    dataId = idFromBody ? String(idFromBody) : '';
  }

  // Validación de origen obligatoria antes de cualquier procesamiento.
  const signatureOk = isValidWebhookSignature({
    signatureHeader: req.header('x-signature'),
    requestIdHeader: req.header('x-request-id'),
    dataId,
    secret: env.mpWebhookSecret,
  });
  if (!signatureOk) {
    console.warn('[mp-webhook] firma inválida o ausente');
    res.status(401).json({ ok: false, error: 'Firma de webhook inválida' });
    return;
  }

  if (type && dataId) {
    await processPaymentWebhook({ type, dataId });
  }

  // Mercado Pago espera 200/201 sin importar si procesamos o no.
  res.status(200).json({ ok: true });
});

/**
 * POST /api/replays/payment/access
 * Body: { accessToken: string }
 * Si el pago está aprobado, retorna un sessionToken JWT para ver el replay.
 */
export const postPaymentAccess = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { accessToken?: unknown };
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
  if (!accessToken) {
    throw new HttpError(400, 'accessToken es requerido');
  }
  const result = await issueSessionFromAccessToken({ accessToken });
  res.json(result);
});

/**
 * GET /api/replays/payment/status?accessToken=...
 * Consulta el estado del pago (polling desde frontend post-checkout).
 */
export const getPaymentStatusEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const accessToken = typeof req.query.accessToken === 'string' ? req.query.accessToken : '';
  if (!accessToken) {
    throw new HttpError(400, 'accessToken es requerido');
  }
  const result = await getPaymentStatus({ accessToken });
  res.setHeader('Cache-Control', 'no-store');
  res.json(result);
});
