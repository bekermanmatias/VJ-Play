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
  payment?: Row | null;
  byExternalRef?: Row | null;
  byAccessToken?: Row | null;
  insertError?: { message: string } | null;
  updateError?: { message: string } | null;
}) {
  const calls: { update: Row[]; insert: Row[]; deletes: number } = {
    update: [],
    insert: [],
    deletes: 0,
  };

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
        return { data: config.pending ?? null, error: null };
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
let originalSecret: string | undefined;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalSecret = env.mpWebhookSecret as string | undefined;
  // Garantizar configuración mínima sin depender del .env real.
  (env as { mpAccessToken?: string }).mpAccessToken = 'TEST-access-token';
  (env as { mpWebhookSecret?: string }).mpWebhookSecret = 'webhook-secret';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  (env as { mpWebhookSecret?: string }).mpWebhookSecret = originalSecret;
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

  function sign(ts: string, id: string, reqId: string, s: string): string {
    const manifest = `id:${id};request-id:${reqId};ts:${ts};`;
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
      assert.equal(body.items[0].unit_price, env.replayPriceArs);
      assert.equal(body.items[0].currency_id, 'ARS');
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
    assert.equal(calls.insert[0].amount, env.replayPriceArs);
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
    assert.equal(calls.update[0].mp_status, 'approved');
    assert.ok(calls.update[0].approved_at);
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

  it('ignora cuando la moneda no coincide', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment({ currency_id: 'USD' }))) as never;

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

  it('marca rejected', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment({ status: 'rejected' }))) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, true);
    assert.equal(calls.update[0].mp_status, 'rejected');
  });

  it('marca cancelled', async () => {
    const { client, calls } = makeSupabaseMock({ byExternalRef: paymentRow() });
    __setSupabaseClientForTests(client as never);
    globalThis.fetch = mock.fn(async () => jsonResponse(mpPayment({ status: 'cancelled' }))) as never;

    const result = await processPaymentWebhook({ type: 'payment', dataId: '987654' });
    assert.equal(result.updated, true);
    assert.equal(calls.update[0].mp_status, 'cancelled');
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
      byAccessToken: {
        match_key: MATCH_KEY,
        mp_status: 'approved',
        amount: 3500,
        approved_at: '2026-01-01T00:00:00.000Z',
      },
    });
    __setSupabaseClientForTests(client as never);

    const result = await issueSessionFromAccessToken({ accessToken: ACCESS_TOKEN });
    assert.ok(result.sessionToken);
    assert.equal(result.matchKey, MATCH_KEY);
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
