/** Debe coincidir con la normalización del backend (NFKC + trim + lower). */
export function buildReplayMatchKey(parts: {
  cancha: string;
  fecha: string;
  hora: string;
}): string {
  const cancha = parts.cancha.normalize('NFKC').trim().toLowerCase();
  const fecha = parts.fecha.normalize('NFKC').trim().toLowerCase();
  const hora = parts.hora.normalize('NFKC').trim().toLowerCase();
  return `${cancha}|${fecha}|${hora}`;
}
