import NewsCard from "./NewsCard";
export default { title: "Varela Junior/Contenido/NewsCard", component: NewsCard, parameters: { renderer: "react" } };
const example = {
  id: "example", slug: "torneo-relampago-futbol-5", title: "¡Arranca el Torneo Relámpago de Fútbol 5!",
  summary: "Este fin de semana te esperamos para vivir el torneo.",
  images: [], categories: [{ slug: "futbol-5", label: "Fútbol 5" }],
  publishedAt: "2026-07-09T12:00:00.000Z", mainImageUrl: "/images/deportes/f5.jpg",
};
export const Default = { args: { news: example } };
export const TituloLargo = { args: { news: { ...example, title: "Novedades, actividades y encuentros deportivos para toda la familia en el Club Social Varela Junior" } } };
