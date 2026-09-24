export type SedeGalleryItem = {
  src: string;
  alt: string;
  caption?: string;
};

export type SedeData = {
  slug: string;
  name: string;
  location: string;
  description: string;
  image: string;
  imageAlt: string;
  amenities: string[];
  gallery: SedeGalleryItem[];
};

/** Agregá las fotos futuras en `gallery` con rutas dentro de /public. */
export const sedes: SedeData[] = [
  {
    slug: "sede-central",
    name: "Sede Central",
    location: "Av. Gral. José de San Martín 3275, Florencio Varela",
    description: "El corazón de la actividad diaria del club. Alberga el salón gimnasio, el natatorio climatizado, las canchas de tenis y el tradicional trinquete de pelota paleta.",
    image: "/images/ubicacion.png",
    imageAlt: "Sede Central del Club Social Varela Junior",
    amenities: ["Natatorio", "Tenis", "Trinquete", "Gimnasio"],
    gallery: [],
  },
  {
    slug: "campo-deportes",
    name: "Campo de Deportes",
    location: "Ruta 53, Florencio Varela",
    description: "Un predio arbolado de 2,5 hectáreas pensado para la familia y el esparcimiento, con canchas de rugby, fútbol, quincho comedor y parrillas.",
    image: "/images/club/camporugby.png",
    imageAlt: "Campo de Deportes del Club Social Varela Junior",
    amenities: ["Rugby", "Fútbol", "Quincho", "Parrillas"],
    gallery: [],
  },
];

export function getSedeBySlug(slug: string): SedeData | undefined {
  return sedes.find((sede) => sede.slug === slug);
}