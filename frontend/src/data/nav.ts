import { deportesGrupos, type NavGroup } from "./deportes";

export type { NavGroup };

export const clubNav: NavGroup = {
  label: "Club",
  href: "/club/institucional",
  items: [
    { label: "Institucional", href: "/club/institucional" },
    { label: "Historia", href: "/club/historia" },
    { label: "Autoridades", href: "/club/autoridades" },
  ],
};

/** Todos los menús desplegables de la barra principal. */
export const navDropdowns: NavGroup[] = [...deportesGrupos, clubNav];

export type NavSimpleLink = {
  label: string;
  href: string;
  /** Icono opcional junto al texto */
  icon?: "replays";
};

export const navSimpleLinks: NavSimpleLink[] = [
  { label: "Noticias", href: "/noticias" },
  { label: "Replays", href: "/replays", icon: "replays" },
  { label: "Socios", href: "/socios" },
];
