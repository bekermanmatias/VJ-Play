import SectionHeader from "./SectionHeader.astro";
export default { title: "Varela Junior/Tipografía/SectionHeader", component: SectionHeader };
export const Noticias = { args: { eyebrow: "Novedades", title: "Noticias" } };
export const Dark = { args: { eyebrow: "Nos acompañan", title: "Sponsors", theme: "dark", align: "center" }, decorators: [(Story) => `<div class="bg-slate-900 px-6 py-8">${Story()}</div>`] };
