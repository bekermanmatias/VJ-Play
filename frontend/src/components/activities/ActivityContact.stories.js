import ActivityContact from "./ActivityContact.astro";
export default { title: "Varela Junior/Actividades/ActivityContact", component: ActivityContact, decorators: [(Story) => `<div class="bg-slate-900 px-6 py-6 text-slate-200">${Story()}</div>`] };
export const Redes = { args: { label: "Coordinación", phones: [{ phone: "011 5364-0616", phoneHref: "tel:+5491153640616" }], whatsappUrl: "https://wa.me/5491153640616", instagramUrl: "https://www.instagram.com/clubsocialvarelajunior/" } };
export const SinRedes = { args: { label: "Coordinación", phones: Redes.args.phones, showUnavailable: true } };
