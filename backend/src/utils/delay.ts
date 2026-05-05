/**
 * Espera sin bloquear el thread del pool (timer del event loop).
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
