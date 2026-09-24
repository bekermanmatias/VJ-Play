/**
 * Tests del middleware que protege las rutas administrativas del API.
 *
 * Verifican que la segunda barrera del backend siga exigiendo el header
 * `x-admin-secret` (el frontend nunca lo conoce: lo agrega Astro SSR).
 *
 * Ejecutar: node --import tsx --test src/middleware/require-admin-secret.test.ts
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { env } from '../config/env.js';
import { HttpError } from '../errors/http-error.js';
import { requireAdminSecret } from './require-admin-secret.js';

const originalSecret = env.adminSecret;

/** `env` expone `adminSecret` como readonly; se muta sólo para el test. */
function setAdminSecret(value: string | undefined): void {
  (env as unknown as { adminSecret: string | undefined }).adminSecret = value;
}

function runMiddleware(headerValue?: string): { statusCode?: number; passed: boolean } {
  const req = {
    header: (name: string) => (name === 'x-admin-secret' ? headerValue : undefined),
  } as never;

  let outcome: { statusCode?: number; passed: boolean } = { passed: false };
  const next = ((error?: unknown) => {
    if (error) {
      outcome = { statusCode: (error as HttpError).statusCode, passed: false };
      return;
    }
    outcome = { passed: true };
  }) as never;

  requireAdminSecret(req, {} as never, next);
  return outcome;
}

describe('requireAdminSecret', () => {
  beforeEach(() => {
    setAdminSecret('test-admin-secret');
  });

  afterEach(() => {
    setAdminSecret(originalSecret);
  });

  it('responde 503 cuando no hay secreto configurado', () => {
    setAdminSecret(undefined);
    assert.equal(runMiddleware('test-admin-secret').statusCode, 503);
  });

  it('responde 401 cuando el header no coincide', () => {
    assert.equal(runMiddleware('incorrecto').statusCode, 401);
    assert.equal(runMiddleware(undefined).statusCode, 401);
  });

  it('continúa cuando el header es correcto', () => {
    assert.equal(runMiddleware('test-admin-secret').passed, true);
  });
});
