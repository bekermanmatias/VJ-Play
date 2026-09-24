import { deportesGrupos, type NavGroup } from "./deportes";

export type { NavGroup };

export const clubNav: NavGroup = {
  label: "Club",
  href: "/club/institucional",
  items: [
    { label: "Institucional", href: "/club/institucional" },
    { label: "Historia", href: "/club/historia" },
    { label: "Autoridades", href: "/club/autoridades" },
    {
      label: "Sedes",
      href: "#",
      children: [
        { label: "Sede Central", href: "/club/sedes/sede-central" },
        { label: "Campo de Deportes", href: "/club/sedes/campo-deportes" },
      ],
    },
  ],
};

export const sociosNav: NavGroup = {
  label: "Socios",
  href: "/socios",
  items: [
    { label: "Asociarme", href: "/socios" },
    { label: "Portal del Socio", href: "#" },
  ],
};

/** Todos los menús desplegables de la barra principal. */
export const navDropdowns: NavGroup[] = [...deportesGrupos, clubNav, sociosNav];

export type NavSimpleLink = {
  label: string;
  href: string;
  /** Icono opcional junto al texto */
  icon?: "replays";
};

export const navSimpleLinks: NavSimpleLink[] = [
  { label: "Noticias", href: "/noticias" },
  { label: "Replays", href: "/replays", icon: "replays" },
];
