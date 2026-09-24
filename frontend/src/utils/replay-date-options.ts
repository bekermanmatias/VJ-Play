/** Fechas para replay: hoy primero, luego 6 días anteriores (ISO `value`). */

export type ReplayDateOption = { value: string; label: string };

export function buildLastSevenDaysOptions(now = new Date()): ReplayDateOption[] {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit", month: "2-digit", year: "numeric",
  }).formatToParts(now);
  const datePart = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const today = Date.UTC(Number(datePart("year")), Number(datePart("month")) - 1, Number(datePart("day")));
  const weekdays = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const out: ReplayDateOption[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today - i * 86_400_000);
    const value = d.toISOString().slice(0, 10);
    const base = `${weekdays[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
    const label = i === 0 ? `Hoy — ${base}` : base;
    out.push({ value, label });
  }
  return out;
}
