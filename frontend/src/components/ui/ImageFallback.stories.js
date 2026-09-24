import ImageFallback from "./ImageFallback.astro";
export default { title: "Varela Junior/Contenido/ImageFallback", component: ImageFallback };
export const Foto = { args: { src: "/images/deportes/futbolinfantil.jpg", alt: "Fútbol infantil", class: "h-64 w-80 object-cover" } };
export const Ausente = { args: { src: "/images/inexistente.jpg", alt: "Imagen no disponible", class: "h-64 w-80 bg-slate-800 object-cover" } };
