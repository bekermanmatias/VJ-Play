import ActivitySchedule from "./ActivitySchedule.astro";
export default { title: "Varela Junior/Actividades/ActivitySchedule", component: ActivitySchedule, decorators: [(Story) => `<div class="bg-slate-900 px-6 py-6 text-slate-200">${Story()}</div>`] };
export const Simple = { args: { title: "Horarios de apertura", items: ["Lunes a viernes — desde las 12 hs", "Sábados — desde las 9 hs"] } };
export const Agrupado = { args: { title: "Categorías y horarios", groups: [{ title: "Infantiles", lines: ["Lunes y miércoles — 18 hs", "Viernes — 19 hs"] }] } };
