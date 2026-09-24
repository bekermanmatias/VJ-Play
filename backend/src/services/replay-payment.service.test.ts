/**
 * Tests del feature de pagos de Mercado Pago.
 *
 * No conectan a Mercado Pago ni a Supabase reales: se mockean `fetch` y el
 * cliente Supabase mediante `__setSupabaseClientForTests`.
 *
 * Ejecutar: node --import tsx --test src/services/replay-payment.service.test.ts
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { createHmac } from 'node:crypto';

import { env } from '../config/env.js';
import { __setSupabaseClientForTests } from '../config/supabase.js';
import { getWebhookNotificationDetails } from '../controllers/replay-payment.controller.js';
import { getReplayStreamPayload } from './replay-access.service.js';
import {
  createPaymentPreference,
  getAccessByToken,
  getPaymentStatus,
  isValidWebhookSignature,
  issueSessionFromAccessToken,
  processPaymentWebhook,
  resolveNextState,
} from './replay-payment.service.js';

/* ------------------------------------------------------------------ */
/*  Helpers de mocking                                                */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

/** Mock mínimo y encadenable del query builder de Supabase. */
function makeSupabaseMock(config: {
  asset?: Row | null;
  approved?: Row | null;
  pending?: Row | null;
  pendingSequence?: (Row | null)[];
  payment?: Row | null;
  byExternalRef?: Row | null;
  byAccessToken?: Row | null;
  insertError?: { message: string; code?: string } | null;
  updateError?: { message: string } | null;
}) {
  const calls: { update: Row[]; insert: Row[]; deletes: number } = {
    update: [],
    insert: [],
    deletes: 0,
  };
  let pendingReadCount = 0;

  function tableFor(name: string): Row | null {
    if (name === 'replay_assets') return config.asset ?? null;
    if (name === 'replay_payments') return null;
    return null;
  }

  function makeTable(name: string) {
    const state: { filters: Record<string, unknown>; query: string } = {
      filters: {},
      query: '',
    };

    const builder: Record<string, unknown> = {};
    const chain = () => builder;

    builder.select = (cols: string) => {
      state.query = cols;
      return chain();
    };
    builder.eq = (col: string, value: unknown) => {
      state.filters[col] = value;
      return chain();
    };
    builder.not = () => chain();
    builder.order = () => chain();
    builder.limit = () => chain();
    builder.maybeSingle = async () => {
      if (name === 'replay_assets') {
        return { data: config.asset ?? null, error: null };
      }
      // replay_payments lookups según los filtros aplicados.
      if (state.filters.mp_status === 'approved') {
        return { data: config.approved ?? null, error: null };
      }
      if (state.filters.mp_status === 'pending') {
        const result = config.pendingSequence
          ? config.pendingSequence[Math.min(pendingReadCount, config.pendingSequence.length - 1)]
          : config.pending;
        pendingReadCount += 1;
        return { data: result ?? null, error: null };
      }
      if (state.filters.external_reference !== undefined) {
        return { data: config.byExternalRef ?? null, error: null };
      }
      if (state.filters.access_token !== undefined) {
        return { data: config.byAccessToken ?? null, error: null };
      }
      return { data: null, error: null };
    };
    builder.single = async () => {
      if (name === 'replay_assets') {
        return { data: config.asset ?? null, error: null };
      }
      return { data: config.payment ?? null, error: config.insertError ?? null };
    };
    builder.insert = (row: Row) => {
      calls.insert.push(row);
      return chain();
    };
    builder.update = (row: Row) => {
      calls.update.push(row);
      return chain();
    };
    builder.delete = () => {
      calls.deletes += 1;
      return chain();
    };
    // `await` sobre el builder de update/delete resuelve la promesa final.
    builder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: config.updateError ?? null }).then(resolve);

    return builder;
  }

  const client = {
    from: (name: string) => makeTable(name),
    _calls: calls,
  };

  return { client, calls };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

const MATCH_KEY = 'cancha-padel|2026-05-15|13:00';
const ACCESS_TOKEN = '11111111-1111-1111-1111-111111111111';
const EXTERNAL_REF = '22222222-2222-2222-2222-222222222222';

function paymentRow(overrides: Row = {}): Row {
  return {
    id: 'row-1',
    match_key: MATCH_KEY,
    access_token: ACCESS_TOKEN,
    external_reference: EXTERNAL_REF,
    mp_preference_id: 'pref-1',
    mp_payment_id: null,
    mp_status: 'pending',
    amount: 3500,
    currency: 'ARS',
    approved_at: null,
    ...overrides,
  };
}

let originalFetch: typeof globalThis.fetch;
let originalAccessToken: string | undefined;
let originalSecret: string | undefined;
let originalSupabaseUrl: string | undefined;
let originalSupabaseKey: string | undefined;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalAccessToken = env.mpAccessToken;
  originalSecret = env.mpWebhookSecret as string | undefined;
  originalSupabaseUrl = env.supabaseUrl;
  originalSupabaseKey = env.supabaseKey;
  // Garantizar configuración mínima sin depender del .env real.
  (env as { mpAccessToken?: string }).mpAccessToken = 'TEST-access-token';
  (env as { mpWebhookSecret?: string }).mpWebhookSecret = 'webhook-secret';
  (env as { supabaseUrl?: string }).supabaseUrl = 'https://supabase.test.invalid';
  (env as { supabaseKey?: string }).supabaseKey = 'test-supabase-key';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  (env as { mpAccessToken?: string }).mpAccessToken = originalAccessToken;
  (env as { mpWebhookSecret?: string }).mpWebhookSecret = originalSecret;
  (env as { supabaseUrl?: string }).supabaseUrl = originalSupabaseUrl;
  (env as { supabaseKey?: string }).supabaseKey = originalSupabaseKey;
  __setSupabaseClientForTests(null);
  mock.restoreAll();
});

/* ------------------------------------------------------------------ */
/*  Firma de webhook                                                  */
/* ------------------------------------------------------------------ */

describe('isValidWebhookSignature', () => {
  const secret = 'webhook-secret';
  const dataId = '123456';
  const requestId = 'req-abc';

  function sign(ts: string, id: string, reqId: string | undefined, s: string): string {
    const manifest = `id:${id};${reqId ? `request-id:${reqId};` : ''}ts:${ts};`;
    return createHmac('sha256', s).update(manifest).digest('hex');
  }

  it('acepta una firma válida', () => {
    const ts = '1704908010';
    const v1 = sign(ts, dataId, requestId, secret);
    assert.equal(
      isValidWebhookSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestIdHeader: requestId,
        dataId,
        secret,
      }),
      true,
    );
  });

  it('normaliza a minúsculas data.id alfanumérico según el manifiesto oficial', () => {
    const ts = '1704908010';
    const v1 = sign(ts, 'ab12cd34', requestId, secret);
    assert.equal(
      isValidWebhookSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestIdHeader: requestId,
        dataId: 'AB12CD34',
        secret,
      }),
      true,
    );
  });

  it('omite request-id del manifiesto cuando el header no viene', () => {
    const ts = '1704908010';
    const v1 = sign(ts, dataId, undefined, secret);
    assert.equal(
      isValidWebhookSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestIdHeader: undefined,
        dataId,
        secret,
      }),
      true,
    );
  });

  it('rechaza una firma inválida', () => {
    assert.equal(
      isValidWebhookSignature({
        signatureHeader: 'ts=1704908010,v1=deadbeef',
        requestIdHeader: requestId,
        dataId,
        secret,
      }),
      false,
    );
  });

  it('rechaza cuando falta el secret', () => {
    assert.equal(
      isValidWebhookSignature({
        signatureHeader: 'ts=1,v1=abc',
        requestIdHeader: requestId,
        dataId,
        secret: undefined,
      }),
      false,
    );
  });

  it('rechaza cuando falta el header o el dataId', () => {
    assert.equal(
      isValidWebhookSignature({
        signatureHeader: undefined,
        requestIdHeader: requestId,
        dataId,
        secret,
      }),
      false,
    );
    assert.equal(
      isValidWebhookSignature({
        signatureHeader: 'ts=1,v1=abc',
        requestIdHeader: requestId,
        dataId: '',
        secret,
      }),
      false,
    );
  });
});

describe('origen de data.id del webhook', () => {
  it('usa el data.id del query aunque el body tenga otro id', () => {
    assert.deepEqual(
      getWebhookNotificationDetails(
        { type: 'payment', 'data.id': 'signed-query-id' },
        { type: 'payment', data: { id: 'untrusted-body-id' } },
      ),
      { type: 'payment', dataId: 'signed-query-id' },
    );
  });

  it('no acepta el id del body cuando falta el data.id del query', () => {
    assert.deepEqual(
      getWebhookNotificationDetails(
        { type: 'payment' },
        { type: 'payment', data: { id: 'body-only-id' } },
      ),
      { type: 'payment', dataId: '' },
    );
  });
});

/* ------------------------------------------------------------------ */
/*  State machine                                                     */
/* ------------------------------------------------------------------ */

describe('resolveNextState', () => {
  it('permite pending → approved', () => {
    assert.equal(resolveNextState('pending', 'approved'), 'approved');
  });

  it('no degrada approved → pending (notificación tardía)', () => {
    assert.equal(resolveNextState('approved', 'pending'), null);
  });

  it('no degrada approved → rejected ni cancelled', () => {
    assert.equal(resolveNextState('approved', 'rejected'), null);
    assert.equal(resolveNextState('approved', 'cancelled'), null);
  });

  it('no degrada approved → approved repetido', () => {
    assert.equal(resolveNextState('approved', 'approved'), 'approved');
  });

  it('permite reintento desde rejected/cancelled', () => {
    assert.equal(resolveNextState('rejected', 'approved'), 'approved');
    assert.equal(resolveNextState('cancelled', 'pending'), 'pending');
  });

  it('ignora estados desconocidos', () => {
    assert.equal(resolveNextState('pending', 'refunded'), null);
  });
});

/* ------------------------------------------------------------------ */
/*  Creación de preferencia                                           */
/* ------------------------------------------------------------------ */

describe('createPaymentPreference', () => {
  it('crea la compra y la preferencia (precio desde backend)', async () => {
    const { client, calls } = makeSupabaseMock({
      asset: { match_key: MATCH_KEY },
      approved: null,
      pending: null,
      payment: { id: 'row-1', access_token: ACCESS_TOKEN, external_reference: EXTERNAL_REF },
    });
    __setSupabaseClientForTests(client as never);

    globalThis.fetch = mock.fn(async (url: string | URL, init?: RequestInit) => {
      assert.match(String(url), /checkout\/preferences$/);
      const body = JSON.parse(String(init?.body)) as {
        items: { unit_price: number; currency_id: string }[];
        external_reference: string;
      };
      assert.equal(body.items[0]!.unit_price, env.replayPriceArs);
      assert.equal(body.items[0]!.currency_id, 'ARS');
      assert.equal(body.external_reference, EXTERNAL_REF);
      return jsonResponse({
        id: 'pref-1',
        init_point: 'https://mp/init',
        sandbox_init_point: 'https://mp/sandbox',
      });
    }) as never;

    const result = await createPaymentPreference({ matchKey: MATCH_KEY });
    assert.equal(result.preferenceId, 'pref-1');
    assert.equal(result.accessToken, ACCESS_TOKEN);
    assert.equal(result.status, 'pending');
    assert.equal(calls.insert.length, 1);
    assert.equal(calls.insert[0]!.amount, env.replayPriceArs);
  });

  it('rechaza un matchKey inválido', async () => {
    await assert.rejects(
      () => createPaymentPreference({ matchKey: 'invalido' }),
      /matchKey inválido/,
    );
  });

  it('devuelve 404 si el partido no existe', async () => {
    const { client } = makeSupabaseMock({ asset: null });
    __setSupabaseClientForTests(client as never);

    await assert.rejects(
      () => createPaymentPreference({ matchKey: MATCH_KEY }),
      /Partido no encontrado/,
    );
  });

  it('reutiliza una compra aprobada sin crear otra preferencia', async () => {
    const { client, calls } = makeSupabaseMock({
      asset: { match_key: MATCH_KEY },
      approved: { access_token: ACCESS_TOKEN, mp_preference_id: 'pref-old', mp_status: 'approved' },
    });
    __setSupabaseClientForTests(client as never);

    const fetchMock = mock.fn();
    globalThis.fetch = fetchMock as never;

    const result = await createPaymentPreference({ matchKey: MATCH_KEY });
    assert.equal(result.status, 'approved');
    assert.equal(result.accessToken, ACCESS_TOKEN);
    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal(calls.insert.length, 0);
  });

  it('reutiliza una compra pendiente con init_point sin duplicar', async () => {
    const { client, calls } = makeSupabaseMock({
      asset: { match_key: MATCH_KEY },
      approved: null,
      pending: {
        access_token: ACCESS_TOKEN,
        mp_preference_id: 'pref-pending',
        init_point: 'https://mp/pending',
      },
    });
    __setSupabaseClientForTests(client as never);

    const fetchMock = mock.fn();
    globalThis.fetch = fetchMock as never;

    const result = await createPaymentPreference({ matchKey: MATCH_KEY });
    assert.equal(result.status, 'pending');
    assert.equal(result.initPoint, 'https://mp/pending');
    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal(calls.insert.length, 0);
  });

  it('recupera una reserva concurrente ya creada sin crear otra preferencia', async () => {
    const { client, calls } = makeSupabaseMock({
      asset: { match_key: MATCH_KEY },
      pendingSequence: [
        null,
        {
          access_token: ACCESS_TOKEN,
          mp_preference_id: 'pref-race',
          init_point: 'https://mp/race',
        },
      ],
      insertError: { code: '23505', message: 'duplicate key' },
    });
    __setSupabaseClientForTests(client as never);

    const fetchMock = mock.fn();
    globalThis.fetch = fetchMock as never;

    const result = await createPaymentPreference({ matchKey: MATCH_KEY });
    assert.equal(result.status, 'pending');
    assert.equal(result.initPoint, 'https://mp/race');
    assert.equal(result.accessToken, ACCESS_TOKEN);
    assert.equal(calls.insert.length, 1);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it('no crea una segunda preferencia mientras otra reserva concurrente está en curso', async () => {
    const { client, calls } = makeSupabaseMock({
      asset: { match_key: MATCH_KEY },
      pendingSequence: [null, { access_token: ACCESS_TOKEN, init_point: null }],
      insertError: { code: '23505', message: 'duplicate key' },
    });
    __setSupabaseClientForTests(client as never);

    const fetchMock = mock.fn();
    globalThis.fetch = fetchMock as never;

    await assert.rejects(
      () => createPaymentPreference({ matchKey: MATCH_KEY }),
      (error: unknown) => {
        assert.equal((error as { statusCode?: number }).statusCode, 409);
        return true;
      },
    );
    assert.equal(calls.insert.length, 1);
    assert.equal(fetchMock.mock.calls.length, 0);
  });
});

/* ------------------------------------------------------------------ */
/*  Webhook                                                           */
/* ------------------------------------------------------------------ */

describe('processPaymentWebhook', () => {
  function mpPayment(overrides: Row = {}): Row {
    return {
      id: 987654,
      status: 'approved',
      status_detail: 'accredited',
      external_reference: EXTERNAL_REF,
      transaction_amount: 3500,
      currency_id: 'ARS',
      payer: { email: 'socio@example.com' },
      metadata: { match_key: MATCH_KEY, access_token: ACCESS_TOKEN },
      ...overrides,
    };
  }

  it('procesa un pago aprobado válido', async () => {
    const { client, calls } = makeSupabaseMock({
      byExternalRef: paymentRow(),
    });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment())) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, true);
    assert.equal(calls.update.length, 1);
    assert.equal(calls.update[0]!.mp_status, 'approved');
    assert.ok(calls.update[0]!.approved_at);
  });

  it('ignora tipos que no son payment', async () => {
    const result = await processPaymentWebhook({ type: 'merchant_order', dataId: '1' });
    assert.equal(result.updated, false);
  });

  it('no degrada approved con una notificación pending tardía', async () => {
    const { client, calls } = makeSupabaseMock({
      byExternalRef: paymentRow({ mp_status: 'approved', mp_payment_id: '987654', approved_at: '2026-01-01T00:00:00.000Z' }),
    });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment({ status: 'pending' }))) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, false);
    assert.equal(calls.update.length, 0);
  });

  it('ignora un payment id que no corresponde a la compra', async () => {
    const { client, calls } = makeSupabaseMock({
      byExternalRef: paymentRow({ mp_payment_id: 'otro-id' }),
    });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment())) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, false);
    assert.equal(calls.update.length, 0);
  });

  it('ignora una external_reference desconocida', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: null });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment())) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, false);
    assert.equal(calls.update.length, 0);
  });

  it('ignora cuando el monto no coincide', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () =>
      jsonResponse(mpPayment({ transaction_amount: 10 })),
    ) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, false);
    assert.equal(calls.update.length, 0);
  });

  it('falla cerrado si el monto no viene en la respuesta de MP', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () =>
      jsonResponse(mpPayment({ transaction_amount: undefined })),
    ) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, false);
    assert.equal(calls.update.length, 0);
  });

  it('ignora cuando la moneda no coincide', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment({ currency_id: 'USD' }))) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, false);
    assert.equal(calls.update.length, 0);
  });

  it('falla cerrado si currency_id no viene en la respuesta de MP', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () =>
      jsonResponse(mpPayment({ currency_id: undefined })),
    ) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, false);
    assert.equal(calls.update.length, 0);
  });

  it('falla cerrado si la respuesta server-to-server tiene otro payment id', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment({ id: 123 }))) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, false);
    assert.equal(calls.update.length, 0);
  });

  it('ignora cuando el match de metadata no coincide', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () =>
      jsonResponse(mpPayment({ metadata: { match_key: 'otra|2026-05-15|13:00' } })),
    ) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, false);
    assert.equal(calls.update.length, 0);
  });

  it('falla cerrado si falta metadata de compra', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment({ metadata: undefined }))) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, false);
    assert.equal(calls.update.length, 0);
  });

  it('falla cerrado si metadata.access_token no coincide con la compra', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () =>
      jsonResponse(mpPayment({ metadata: { match_key: MATCH_KEY, access_token: 'otro-token' } })),
    ) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, false);
    assert.equal(calls.update.length, 0);
  });

  it('marca rejected', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment({ status: 'rejected' }))) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, true);
    assert.equal(calls.update[0]!.mp_status, 'rejected');
  });

  it('marca cancelled', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment({ status: 'cancelled' }))) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, true);
    assert.equal(calls.update[0]!.mp_status, 'cancelled');
  });

  it('es idempotente ante un webhook repetido del mismo estado aprobado', async () => {
    const { client, calls } = makeSupabaseMock({
      byExternalRef: paymentRow({
        mp_status: 'approved',
        mp_payment_id: '987654',
        approved_at: '2026-01-01T00:00:00.000Z',
      }),
    });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment())) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, false);
    assert.equal(calls.update.length, 0);
  });

  it('lanza error si MP devuelve un payment desconocido', async () => {
    const { client } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse({ message: 'not found' }, false, 404)) as never;

    await assert.rejects(
      () => processPaymentWebhook({ type: 'payment', dataId: '000' }),
      /No se pudo verificar el pago/,
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Acceso por token                                                  */
/* ------------------------------------------------------------------ */

describe('acceso por access token', () => {
  it('rechaza un token inexistente', async () => {
    const { client } = makeSupabaseMock({ byAccessToken: null });
    __setSupabaseClientForTests(client as never);

    await assert.rejects(
      () => getAccessByToken({ accessToken: 'nope' }),
      /Token de acceso no encontrado/,
    );
  });

  it('no emite sesión si el pago no está aprobado (acceso antes de aprobación)', async () => {
    const { client } = makeSupabaseMock({
      byAccessToken: { match_key: MATCH_KEY, mp_status: 'pending', amount: 3500, approved_at: null },
    });
    __setSupabaseClientForTests(client as never);

    await assert.rejects(
      () => issueSessionFromAccessToken({ accessToken: ACCESS_TOKEN }),
      /El pago aún no fue aprobado/,
    );
  });

  it('emite sesión para un pago aprobado', async () => {
    const { client } = makeSupabaseMock({
      asset: { video_url: 'https://media.example.test/replay.mp4', poster_url: null },
      byAccessToken: {
        match_key: MATCH_KEY,
        mp_status: 'approved',
        amount: 3500,
        approved_at: '2026-01-01T00:00:00.000Z',
      },
    });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => new Response(null, { status: 200 })) as never;

    const result = await issueSessionFromAccessToken({ accessToken: ACCESS_TOKEN });
    assert.ok(result.sessionToken);
    assert.equal(result.matchKey, MATCH_KEY);
    const { verifyReplaySessionToken } = await import('./replay-session-token.js');
    assert.equal(verifyReplaySessionToken(result.sessionToken, env.jwtSessionSecret)?.paymentAccess, true);
  });

  it('no emite sesión aprobada si el replay ya no está disponible', async () => {
    const { client } = makeSupabaseMock({
      asset: null,
      byAccessToken: {
        match_key: MATCH_KEY,
        mp_status: 'approved',
        amount: 3500,
        approved_at: '2026-01-01T00:00:00.000Z',
      },
    });
    __setSupabaseClientForTests(client as never);

    await assert.rejects(
      () => issueSessionFromAccessToken({ accessToken: ACCESS_TOKEN }),
      /El replay ya no está disponible/,
    );
  });

  it('no emite sesión si la URL del replay ya no está disponible', async () => {
    const { client } = makeSupabaseMock({
      asset: { video_url: 'https://media.example.test/deleted.mp4', poster_url: null },
      byAccessToken: {
        match_key: MATCH_KEY,
        mp_status: 'approved',
        amount: 3500,
        approved_at: '2026-01-01T00:00:00.000Z',
      },
    });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => new Response(null, { status: 404 })) as never;

    await assert.rejects(
      () => issueSessionFromAccessToken({ accessToken: ACCESS_TOKEN }),
      /El replay ya no está disponible/,
    );
  });

  it('vuelve a comprobar el asset al resolver un stream pagado', async () => {
    const config: { asset: Row | null; byAccessToken: Row } = {
      asset: { video_url: 'https://media.example.test/replay.mp4', poster_url: null },
      byAccessToken: {
        match_key: MATCH_KEY,
        mp_status: 'approved',
        amount: 3500,
        approved_at: '2026-01-01T00:00:00.000Z',
      },
    };
    const { client } = makeSupabaseMock(config);
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => new Response(null, { status: 200 })) as never;
    const access = await issueSessionFromAccessToken({ accessToken: ACCESS_TOKEN });

    config.asset = null;
    await assert.rejects(
      () => getReplayStreamPayload({ authorizationHeader: `Bearer ${access.sessionToken}` }),
      /El replay ya no está disponible/,
    );
  });

  it('vuelve a denegar un stream pagado si el objeto remoto desapareció', async () => {
    const { client } = makeSupabaseMock({
      asset: { video_url: 'https://media.example.test/replay.mp4', poster_url: null },
      byAccessToken: {
        match_key: MATCH_KEY,
        mp_status: 'approved',
        amount: 3500,
        approved_at: '2026-01-01T00:00:00.000Z',
      },
    });
    __setSupabaseClientForTests(client as never);
    let headChecks = 0;
    globalThis.fetch = mock.fn(async (_url: string | URL, init?: RequestInit) => {
      assert.equal(init?.method, 'HEAD');
      headChecks += 1;
      return new Response(null, { status: headChecks === 1 ? 200 : 410 });
    }) as never;
    const access = await issueSessionFromAccessToken({ accessToken: ACCESS_TOKEN });

    await assert.rejects(
      () => getReplayStreamPayload({ authorizationHeader: `Bearer ${access.sessionToken}` }),
      /El replay ya no está disponible/,
    );
    assert.equal(headChecks, 2);
  });

  it('expone el estado y link de acceso en el polling', async () => {
    const { client } = makeSupabaseMock({
      byAccessToken: {
        match_key: MATCH_KEY,
        mp_status: 'approved',
        amount: 3500,
        approved_at: '2026-01-01T00:00:00.000Z',
      },
    });
    __setSupabaseClientForTests(client as never);

    const result = await getPaymentStatus({ accessToken: ACCESS_TOKEN });
    assert.equal(result.status, 'approved');
    assert.match(result.accessLink, /\/replays\/ver\?token=/);
  });
});
