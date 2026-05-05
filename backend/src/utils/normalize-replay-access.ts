export function normalizeMatchKey(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase();
}

export function normalizeAccessCode(raw: string): string {
  return raw.normalize('NFKC').trim().replace(/\s+/g, '').toUpperCase();
}
