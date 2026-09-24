import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { getSupabase } from '../config/supabase.js';
import { HttpError } from '../errors/http-error.js';
import { normalizeMatchKey } from '../utils/normalize-replay-access.js';
import { fetchReplayAssetsForPaidAccess } from './replay-access.service.js';
import {
  signReplaySessionToken,
} from './replay-session-token.js';

/* ------------------------------------------------------------------ */
/*  Tipos                                                             */
/* ------------------------------------------------------------------ */

type MpPreferenceResponse = {
  id: string;
  init_point: string;
  sandbox_init_point: string;
};

type MpPaymentResponse = {
  id: number | string;
  status: string;
  status_detail: string;
  external_reference: string | null;
  payer?: { email?: string };
  transaction_amount?: number;
  currency_id?: string;
  metadata?: Record<string, unknown> | null;
};

type PaymentRow = {
  id: string;
  match_key: string;
  access_token: string;
  external_reference: string;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  mp_status: string;
  amount: number;
  currency: string;
  approved_at: string | null;
};

/** Estados de la compra aceptados por la state machine. */
const PAYMENT_STATES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
type PaymentState = (typeof PAYMENT_STATES)[number];

/**
 * Transiciones permitidas. Un pago aprobado es terminal (no se degrada por
 * notificaciones tardías). Los refunds/chargebacks quedan pendientes de diseño:
 * no se modelan todavía.
 */
const ALLOWED_TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  pending: ['pending', 'approved', 'rejected', 'cancelled'],
  approved: ['approved'],
  rejected: ['rejected', 'pending', 'approved'],
  cancelled: ['cancelled', 'pending', 'approved'],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function splitMatchKey(matchKey: string): { court: string; date: string; shift: string } {
  const parts = matchKey.split('|');
  return {
    court: parts[0] ?? '',
    date: parts[1] ?? '',
    shift: parts[2] ?? '',
  };
}

function isSandboxToken(): boolean {
  const token = env.mpAccessToken ?? '';
  return token.startsWith('TEST-') || token.startsWith('APP_USR-') === false;
}

export function normalizePaymentState(raw: string | null | undefined): PaymentState | null {
  if (!raw) {
    return null;
  }
  const value = raw.trim().toLowerCase();
  return (PAYMENT_STATES as readonly string[]).includes(value) ? (value as PaymentState) : null;
}

/**
 * Decide el próximo estado respetando la state machine.
 * Devuelve null cuando la transición no está permitida y hay que ignorarla.
 */
export function resolveNextState(
  current: string | null | undefined,
  incoming: string | null | undefined,
): PaymentState | null {
  const next = normalizePaymentState(incoming);
  if (!next) {
    return null;
  }
  const prev = normalizePaymentState(current);
  if (!prev) {
    // Sin estado previo reconocible aceptamos cualquier estado válido entrante.
    return next;
  }
  return ALLOWED_TRANSITIONS[prev].includes(next) ? next : null;
}

/* ------------------------------------------------------------------ */
/*  Validación de firma del webhook (x-signature)                      */
/* ------------------------------------------------------------------ */

type SignatureValidationInput = {
  signatureHeader: string | undefined;
  requestIdHeader: string | undefined;
  dataId: string;
  secret: string | undefined;
};

/**
 * Valida el header `x-signature` según el mecanismo documentado por Mercado Pago.
 * Manifiesto: `id:[data.id];[request-id:[x-request-id];]ts:[ts];`
 * El valor esperado es HMAC-SHA256(secret, manifest) en hex, comparado con `v1`.
 */
export function isValidWebhookSignature(input: SignatureValidationInput): boolean {
  const { signatureHeader, requestIdHeader, dataId, secret } = input;
  if (!secret) {
    return false;
  }
  if (!signatureHeader || !dataId) {
    return false;
  }

  const parts = new Map<string, string>();
  for (const chunk of signatureHeader.split(',')) {
    const [key, ...rest] = chunk.split('=');
    if (!key || rest.length === 0) {
      continue;
    }
    parts.set(key.trim(), rest.join('=').trim());
  }

  const ts = parts.get('ts');
  const v1 = parts.get('v1');
  if (!ts || !v1) {
    return false;
  }

  const manifestParts = [`id:${dataId.toLowerCase()}`];
  if (requestIdHeader) {
    manifestParts.push(`request-id:${requestIdHeader}`);
  }
  manifestParts.push(`ts:${ts}`);
  const manifest = `${manifestParts.join(';')};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(v1, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ */
/*  Crear o reutilizar compra + preferencia de Mercado Pago            */
/* ------------------------------------------------------------------ */

export async function createPaymentPreference(params: {
  matchKey: string;
}): Promise<{
  preferenceId: string;
  initPoint: string;
  accessToken: string;
  status: string;
}> {
  const mk = normalizeMatchKey(params.matchKey);
  if (!mk || mk.split('|').length < 3) {
    throw new HttpError(400, 'matchKey inválido');
  }

  if (!env.mpAccessToken) {
    throw new HttpError(503, 'Mercado Pago no configurado (falta MP_ACCESS_TOKEN)');
  }
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'Supabase no configurado');
  }

  // Verificar que el partido existe en replay_assets.
  const sb = getSupabase();
  const { data: asset, error: assetErr } = await sb
    .from('replay_assets')
    .select('match_key')
    .eq('match_key', mk)
    .maybeSingle();
  if (assetErr) {
    console.error('[mp-create-preference] asset check', assetErr.message);
    throw new HttpError(503, 'No se pudo verificar el partido');
  }
  if (!asset) {
    throw new HttpError(404, 'Partido no encontrado');
  }

  // Idempotencia: reutilizar una compra aprobada existente.
  const { data: existingApproved, error: approvedErr } = await sb
    .from('replay_payments')
    .select('access_token,mp_preference_id,mp_status')
    .eq('match_key', mk)
    .eq('mp_status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (approvedErr) {
    console.error('[mp-create-preference] approved check', approvedErr.message);
    throw new HttpError(503, 'No se pudo verificar el pago existente');
  }
  if (existingApproved) {
    const accessToken: string = existingApproved.access_token;
    const siteUrl = env.publicSiteUrl.replace(/\/$/, '');
    return {
      preferenceId: existingApproved.mp_preference_id ?? '',
      initPoint: `${siteUrl}/replays/ver?token=${accessToken}`,
      accessToken,
      status: 'approved',
    };
  }

  // Idempotencia: reutilizar una compra pendiente reciente en lugar de duplicarla.
  const { data: existingPending, error: pendingErr } = await sb
    .from('replay_payments')
    .select('access_token,mp_preference_id,init_point')
    .eq('match_key', mk)
    .eq('mp_status', 'pending')
    .not('init_point', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pendingErr) {
    console.error('[mp-create-preference] pending check', pendingErr.message);
    throw new HttpError(503, 'No se pudo verificar el pago existente');
  }
  if (existingPending?.init_point) {
    return {
      preferenceId: existingPending.mp_preference_id ?? '',
      initPoint: existingPending.init_point,
      accessToken: existingPending.access_token,
      status: 'pending',
    };
  }

  // Crear registro de pago pendiente (genera access_token y external_reference).
  const { data: payment, error: insertErr } = await sb
    .from('replay_payments')
    .insert({
      match_key: mk,
      mp_status: 'pending',
      amount: env.replayPriceArs,
      currency: env.replayCurrency,
    })
    .select('id,access_token,external_reference')
    .single();

  if (insertErr?.code === '23505') {
    // Un índice único parcial por match_key arbitra requests concurrentes.
    // Si otra request ya reservó la compra, reutilizar su checkout o pedir retry
    // mientras la preferencia todavía se está creando; nunca crear otro cobro.
    const { data: concurrentPending, error: concurrentErr } = await sb
      .from('replay_payments')
      .select('access_token,mp_preference_id,init_point')
      .eq('match_key', mk)
      .eq('mp_status', 'pending')
      .maybeSingle();

    if (concurrentErr) {
      console.error('[mp-create-preference] concurrent pending lookup', concurrentErr.message);
      throw new HttpError(503, 'No se pudo verificar el pago existente');
    }
    if (concurrentPending?.init_point) {
      return {
        preferenceId: concurrentPending.mp_preference_id ?? '',
        initPoint: concurrentPending.init_point,
        accessToken: concurrentPending.access_token,
        status: 'pending',
      };
    }
    throw new HttpError(409, 'Ya se está creando un checkout para este replay; intentá nuevamente');
  }

  if (insertErr || !payment) {
    console.error('[mp-create-preference] insert', insertErr?.message);
    throw new HttpError(503, 'No se pudo crear el registro de pago');
  }

  const accessToken: string = payment.access_token;
  const externalReference: string = payment.external_reference;
  const { court, date, shift } = splitMatchKey(mk);

  const siteUrl = env.publicSiteUrl.replace(/\/$/, '');

  // Crear preferencia en Mercado Pago API.
  const mpBody = {
    items: [
      {
        title: `Replay — ${court} ${date} ${shift}`,
        description: `Acceso al replay del partido. Cancha: ${court}, Fecha: ${date}, Turno: ${shift}`,
        quantity: 1,
        currency_id: env.replayCurrency,
        unit_price: env.replayPriceArs,
      },
    ],
    back_urls: {
      success: `${siteUrl}/replays/pago?token=${accessToken}&status=approved`,
      pending: `${siteUrl}/replays/pago?token=${accessToken}&status=pending`,
      failure: `${siteUrl}/replays/pago?token=${accessToken}&status=failure`,
    },
    auto_return: 'approved' as const,
    external_reference: externalReference,
    metadata: {
      match_key: mk,
      access_token: accessToken,
    },
    notification_url: `${siteUrl}/api/replays/payment/webhook`,
    statement_descriptor: 'VJ Play Replay',
  };

  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.mpAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mpBody),
  });

  const mpData = (await mpRes.json().catch(() => null)) as MpPreferenceResponse | null;

  if (!mpRes.ok || !mpData?.id) {
    console.error('[mp-create-preference] MP API error', mpRes.status, mpData);
    // Limpiar registro huérfano.
    await sb.from('replay_payments').delete().eq('id', payment.id);
    throw new HttpError(502, 'No se pudo crear la preferencia de pago en Mercado Pago');
  }

  const sandbox = isSandboxToken();
  const initPoint = sandbox ? mpData.sandbox_init_point : mpData.init_point;

  // Persistir el ID de preferencia y el link para reutilización idempotente.
  await sb
    .from('replay_payments')
    .update({
      mp_preference_id: mpData.id,
      init_point: initPoint || mpData.init_point,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id);

  return {
    preferenceId: mpData.id,
    initPoint: initPoint || mpData.init_point,
    accessToken,
    status: 'pending',
  };
}

/* ------------------------------------------------------------------ */
/*  Procesar webhook de Mercado Pago                                  */
/* ------------------------------------------------------------------ */

async function fetchPaymentFromMp(paymentId: string): Promise<MpPaymentResponse> {
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${env.mpAccessToken}`,
    },
  });

  if (!mpRes.ok) {
    console.error('[mp-webhook] MP API error', mpRes.status);
    throw new HttpError(502, 'No se pudo verificar el pago en Mercado Pago');
  }

  const mpPayment = (await mpRes.json().catch(() => null)) as MpPaymentResponse | null;
  if (!mpPayment) {
    console.error('[mp-webhook] respuesta inválida de MP');
    throw new HttpError(502, 'Respuesta inválida de Mercado Pago');
  }
  return mpPayment;
}

export async function processPaymentWebhook(params: {
  type: string;
  dataId: string;
}): Promise<{ updated: boolean; reason?: string }> {
  // Solo procesamos notificaciones de tipo "payment".
  if (params.type !== 'payment') {
    return { updated: false, reason: 'tipo no soportado' };
  }

  if (!env.mpAccessToken) {
    console.warn('[mp-webhook] MP_ACCESS_TOKEN no configurado, ignorando webhook');
    return { updated: false, reason: 'mercadopago no configurado' };
  }
  if (!env.supabaseUrl || !env.supabaseKey) {
    console.warn('[mp-webhook] Supabase no configurado, ignorando webhook');
    return { updated: false, reason: 'supabase no configurado' };
  }

  // Consultar el pago en Mercado Pago para obtener datos verificados (server-to-server).
  const mpPayment = await fetchPaymentFromMp(params.dataId);
  const paymentId = String(mpPayment.id);
  if (paymentId.toLowerCase() !== params.dataId.toLowerCase()) {
    console.warn('[mp-webhook] payment id no coincide con data.id firmado');
    return { updated: false, reason: 'payment id distinto a data.id' };
  }

  const externalRef = mpPayment.external_reference;
  if (!externalRef) {
    console.warn('[mp-webhook] pago sin external_reference, ignorando');
    return { updated: false, reason: 'sin external_reference' };
  }

  const sb = getSupabase();

  // Buscar la compra por external_reference (no por el body del webhook).
  const { data: row, error: lookupErr } = await sb
    .from('replay_payments')
    .select('id,match_key,access_token,external_reference,mp_payment_id,mp_status,amount,currency,approved_at')
    .eq('external_reference', externalRef)
    .maybeSingle();

  if (lookupErr) {
    console.error('[mp-webhook] lookup error', lookupErr.message);
    throw new HttpError(503, 'No se pudo verificar el pago');
  }
  if (!row) {
    console.warn('[mp-webhook] external_reference desconocida, ignorando');
    return { updated: false, reason: 'external_reference desconocida' };
  }

  const payment = row as PaymentRow;

  // Verificar que el pago de MP corresponda a nuestra compra.
  if (payment.mp_payment_id && payment.mp_payment_id !== paymentId) {
    console.warn('[mp-webhook] payment id no coincide con la compra');
    return { updated: false, reason: 'payment id distinto' };
  }

  const metadata = mpPayment.metadata;
  if (
    !metadata ||
    typeof metadata.match_key !== 'string' ||
    normalizeMatchKey(metadata.match_key) !== payment.match_key ||
    typeof metadata.access_token !== 'string' ||
    metadata.access_token !== payment.access_token
  ) {
    console.warn('[mp-webhook] metadata de compra ausente o no coincide');
    return { updated: false, reason: 'metadata distinta' };
  }

  // Validar importe y moneda contra los valores guardados en el backend.
  const expectedAmount = Number(payment.amount);
  const incomingAmount = mpPayment.transaction_amount;
  if (
    typeof incomingAmount !== 'number' ||
    !Number.isFinite(incomingAmount) ||
    Math.abs(incomingAmount - expectedAmount) > 0.01
  ) {
    console.warn('[mp-webhook] monto ausente o no coincide');
    return { updated: false, reason: 'monto distinto' };
  }
  if (mpPayment.currency_id !== payment.currency) {
    console.warn('[mp-webhook] moneda ausente o no coincide');
    return { updated: false, reason: 'moneda distinta' };
  }

  // State machine: ignorar transiciones no permitidas (p. ej. approved → pending tardío).
  const nextState = resolveNextState(payment.mp_status, mpPayment.status);
  if (!nextState) {
    console.warn(
      `[mp-webhook] transición ignorada ${payment.mp_status} → ${mpPayment.status} (pago ${paymentId})`,
    );
    return { updated: false, reason: 'transición no permitida' };
  }

  if (nextState === payment.mp_status && payment.mp_payment_id === paymentId) {
    // Notificación repetida sobre el mismo estado: no reescribimos.
    return { updated: false, reason: 'sin cambios' };
  }

  const updateData: Record<string, unknown> = {
    mp_payment_id: paymentId,
    mp_status: nextState,
    payer_email: mpPayment.payer?.email ?? null,
    updated_at: new Date().toISOString(),
  };

  if (nextState === 'approved') {
    updateData.approved_at = payment.approved_at ?? new Date().toISOString();
  }

  const { error } = await sb.from('replay_payments').update(updateData).eq('id', payment.id);

  if (error) {
    console.error('[mp-webhook] update error', error.message);
    throw new HttpError(503, 'No se pudo actualizar el pago');
  }

  console.log(`[mp-webhook] pago ${paymentId} → ${nextState} (match: ${payment.match_key})`);
  return { updated: true };
}

/* ------------------------------------------------------------------ */
/*  Obtener acceso por access_token (link permanente)                 */
/* ------------------------------------------------------------------ */

export async function getAccessByToken(params: {
  accessToken: string;
}): Promise<{
  matchKey: string;
  status: string;
  amount: number;
  approvedAt: string | null;
}> {
  const token = params.accessToken.trim();
  if (!token) {
    throw new HttpError(400, 'Token de acceso requerido');
  }
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'Supabase no configurado');
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('replay_payments')
    .select('match_key,mp_status,amount,approved_at')
    .eq('access_token', token)
    .maybeSingle();

  if (error) {
    console.error('[mp-access-by-token]', error.message);
    throw new HttpError(503, 'No se pudo verificar el acceso');
  }
  if (!data) {
    throw new HttpError(404, 'Token de acceso no encontrado');
  }

  return {
    matchKey: data.match_key,
    status: data.mp_status,
    amount: data.amount,
    approvedAt: data.approved_at,
  };
}

/* ------------------------------------------------------------------ */
/*  Emitir session JWT desde access_token de pago aprobado            */
/* ------------------------------------------------------------------ */

export async function issueSessionFromAccessToken(params: {
  accessToken: string;
}): Promise<{
  sessionToken: string;
  expiresAt: string;
  matchKey: string;
}> {
  const access = await getAccessByToken(params);

  if (access.status !== 'approved') {
    throw new HttpError(402, 'El pago aún no fue aprobado');
  }

  await fetchReplayAssetsForPaidAccess(access.matchKey);

  const now = Math.floor(Date.now() / 1000);
  const exp = now + env.replaySessionTtlSeconds;
  const sessionToken = signReplaySessionToken(
    { mk: access.matchKey, iat: now, exp, paymentAccess: true },
    env.jwtSessionSecret,
  );

  return {
    sessionToken,
    expiresAt: new Date(exp * 1000).toISOString(),
    matchKey: access.matchKey,
  };
}

/* ------------------------------------------------------------------ */
/*  Consultar estado del pago (polling desde frontend)                */
/* ------------------------------------------------------------------ */

export async function getPaymentStatus(params: {
  accessToken: string;
}): Promise<{
  status: string;
  matchKey: string;
  accessLink: string;
}> {
  const access = await getAccessByToken(params);
  const siteUrl = env.publicSiteUrl.replace(/\/$/, '');

  return {
    status: access.status,
    matchKey: access.matchKey,
    accessLink: `${siteUrl}/replays/ver?token=${params.accessToken.trim()}`,
  };
}
