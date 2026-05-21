/**
 * Patrocinadores del home.
 * Logo recomendado: PNG/SVG fondo transparente, ~280×80 px, en public/images/sponsors/
 */
export type Sponsor = {
  name: string;
  logoSrc?: string;
  logoAlt?: string;
  href?: string;
};

export const homeSponsors: Sponsor[] = [
  { name: "Sponsor 1" },
  { name: "Sponsor 2" },
  { name: "Sponsor 3" },
  { name: "Sponsor 4" },
  { name: "Sponsor 5" },
];
