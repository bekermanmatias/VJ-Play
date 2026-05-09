/**
 * Normaliza `match_key` (`cancha|fecha|hora`, mismo criterio que el backend) a un fragmento
 * seguro para nombres de archivo: `cancha-fecha-hora`.
 */
export function matchKeyToDownloadFileStem(matchKey: string): string {
  const mk = matchKey.normalize("NFKC").trim().toLowerCase();
  const triple = mk.split("|").map((p) => p.trim());
  if (triple.length >= 3 && triple[0] && triple[1] && triple[2]) {
    const [cancha, fecha, hora] = triple;
    return [cancha, fecha, hora].map(sanitizeFilenameSegment).filter(Boolean).join("-") || "partido";
  }
  const fallback = mk.replace(/\|/g, "-");
  return sanitizeFilenameSegment(fallback) || "partido";
}

function sanitizeFilenameSegment(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const out = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return out;
}
