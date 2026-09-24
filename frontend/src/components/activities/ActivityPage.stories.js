import DeporteSplitLayout from "../deportes/DeporteSplitLayout.astro";
import { getDeporteBySlug } from "../../data/deportes";
export default { title: "Varela Junior/Actividades/ActivityHero", component: DeporteSplitLayout, parameters: { layout: "fullscreen" } };
export const FutbolInfantil = { args: { data: getDeporteBySlug("futbol-infantil") } };
export const NatacionJubilados = { args: { data: getDeporteBySlug("natacion-jubilados") } };
