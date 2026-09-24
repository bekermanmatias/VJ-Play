import Button from "./Button.astro";
export default { title: "Varela Junior/Acciones/Button", component: Button };
export const Primary = { args: { label: "Ver más", variant: "primary" } };
export const Outline = { args: { label: "Ver todas", variant: "outline" } };
export const Dark = { args: { label: "WhatsApp", variant: "dark" }, decorators: [(Story) => `<div class="bg-slate-900 px-6 py-6">${Story()}</div>`] };
export const Disabled = { args: { label: "No disponible", disabled: true } };
