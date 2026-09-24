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

export function getWebhookNotificationDetails(
  query: Record<string, unknown>,
  body: unknown,
): { type: string; dataId: string } {
  const queryType = typeof query.type === 'string' ? query.type : '';
  const dataId = typeof query['data.id'] === 'string' ? query['data.id'] : '';
  const jsonBody = body as { type?: unknown; action?: unknown } | null;
  const bodyType = typeof jsonBody?.type === 'string' ? jsonBody.type : '';
  const actionIsPayment =
    typeof jsonBody?.action === 'string' && jsonBody.action.includes('payment');

  // Mercado Pago firma data.id en el query string. El body nunca puede sustituirlo.
  return {
    type: queryType || bodyType || (actionIsPayment ? 'payment' : ''),
    dataId,
  };
}

/**
 * POST /api/replays/payment/webhook
 * Notificación de Mercado Pago.
 * Acepta tanto el formato topic/id (IPN) como el formato JSON (webhooks v2).
 * Valida `x-signature` antes de procesar: firma inválida → 401 y no se toca ningún pago.
 */
export const postPaymentWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { type, dataId } = getWebhookNotificationDetails(
    req.query as Record<string, unknown>,
    req.body,
  );

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
