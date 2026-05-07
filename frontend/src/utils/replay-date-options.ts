/** Fechas para replay: hoy primero, luego 6 días anteriores (ISO `value`). */

export type ReplayDateOption = { value: string; label: string };

export function buildLastSevenDaysOptions(): ReplayDateOption[] {
  const now = new Date();
  const out: ReplayDateOption[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const value = d.toISOString().split("T")[0] ?? "";
    const base = d.toLocaleDateString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const label = i === 0 ? `Hoy — ${base}` : base;
    out.push({ value, label });
  }
  return out;
}
