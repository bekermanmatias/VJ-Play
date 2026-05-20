/**
 * Contenido de cada pestaña en /deportes/[slug].
 *
 * FOTO IDEAL (panel derecho, 50% del ancho en desktop):
 *   - Tamaño recomendado: 1200 × 800 px (proporción 3:2)
 *   - Retina / pantallas grandes: 1600 × 1067 px
 *   - Formato: JPG o WebP, calidad 80–85, ideal < 400 KB
 *   - Guardar en: public/images/deportes/[slug].jpg (o .webp)
 *
 * Redes: completá whatsappUrl e instagramUrl por actividad.
 *   WhatsApp: https://wa.me/549XXXXXXXXXX?text=Hola%2C%20consulta%20por%20PADEL
 *   Instagram: https://www.instagram.com/tu_cuenta_padel/
 */

export type DeportePageData = {
  slug: string;
  /** Título grande en el panel oscuro (ej. PÁDEL) */
  title: string;
  /** Nombre tipo título usado en "Noticias sobre [X]" y en menús (ej. Pádel). */
  displayName: string;
  metaTitle: string;
  metaDescription: string;
  /** Párrafos en orden (texto blanco) */
  paragraphs: string[];
  /** Bloque opcional de horarios / categorías */
  scheduleTitle?: string;
  scheduleItems?: string[];
  /** Encabezado del bloque de contacto (ej. "Reservas", "Coordinadores"). */
  contactLabel?: string;
  /** Teléfono único: si hay uno solo, usar estos dos campos. */
  contactPhone?: string;
  contactPhoneHref?: string;
  /** Si hay varios teléfonos, usar este array (tiene prioridad sobre contactPhone). */
  contactPhones?: Array<{
    /** Nombre del responsable, opcional (ej. "Thiago"). */
    name?: string;
    /** Número visible (ej. "+54 9 11 6426-5720"). */
    phone: string;
    /** Link tel: (ej. "tel:+5491164265720"). */
    phoneHref: string;
  }>;
  /** Vacío = no se muestra el botón */
  whatsappUrl: string;
  instagramUrl: string;
  /** Ruta bajo /public */
  imageSrc: string;
  imageAlt: string;
  /** Dimensiones reales del archivo (para width/height del img) */
  imageWidth: number;
  imageHeight: number;
};

const PLACEHOLDER_IMG = "/images/deportes/placeholder.svg";

/** Genera URL wa.me con texto pre-armado. */
function wsp(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export const deportes: DeportePageData[] = [
  {
    slug: "futbol-5",
    title: "FÚTBOL 5",
    displayName: "Fútbol 5",
    metaTitle: "Fútbol 5 | Club Social Varela Junior",
    metaDescription:
      "Canchas de fútbol 5 del Club Social Varela Junior. Reservas, horarios y contacto.",
    paragraphs: [
      "Canchas de fútbol 5 del CVJ para reservar todos los días de la semana.",
      "Lunes a viernes abrimos desde las 12 hs. Sábados desde las 9 hs. Domingos desde las 13:30 hs.",
    ],
    scheduleTitle: "Horarios de apertura",
    scheduleItems: [
      "Lunes a viernes — desde las 12 hs",
      "Sábados — desde las 9 hs",
      "Domingos — desde las 13:30 hs",
    ],
    contactLabel: "Reservas",
    contactPhones: [
      { phone: "4237-6276", phoneHref: "tel:+541142376276" },
      { phone: "+54 9 11 7026-7446", phoneHref: "tel:+5491170267446" },
    ],
    whatsappUrl: wsp("5491170267446", "Hola, quiero reservar fútbol 5 en el CVJ"),
    instagramUrl: "https://www.instagram.com/varelajrfutbol/",
    imageSrc: "/images/deportes/f5.png",
    imageAlt: "Fútbol 5 — Club Social Varela Junior",
    imageWidth: 1200,
    imageHeight: 800,
  },
  {
    slug: "futbol-femenino",
    title: "FÚTBOL FEMENINO",
    displayName: "Fútbol Femenino",
    metaTitle: "Fútbol Femenino | Club Social Varela Junior",
    metaDescription: "Fútbol femenino del Club Social Varela Junior.",
    paragraphs: [
      "Sumate al equipo de fútbol femenino del CVJ.",
      "Seguinos en Instagram para enterarte de entrenamientos, partidos y novedades.",
    ],
    whatsappUrl: "",
    instagramUrl: "https://www.instagram.com/clubvarelajuniorfem/",
    imageSrc: PLACEHOLDER_IMG,
    imageAlt: "Fútbol femenino — Club Social Varela Junior",
    imageWidth: 1200,
    imageHeight: 800,
  },
  {
    slug: "padel",
    title: "PÁDEL",
    displayName: "Pádel",
    metaTitle: "Pádel | Club Social Varela Junior",
    metaDescription:
      "Canchas de pádel del Club Social Varela Junior. Reservas, escuelita y turnos.",
    paragraphs: [
      "Canchas de pádel del Club Social Varela Junior para socios y visitantes.",
      "Lunes a viernes abrimos desde las 12 hs. Sábados desde las 9 hs. Domingos desde las 13:30 hs.",
    ],
    scheduleTitle: "Horarios de apertura",
    scheduleItems: [
      "Lunes a viernes — desde las 12 hs",
      "Sábados — desde las 9 hs",
      "Domingos — desde las 13:30 hs",
    ],
    contactLabel: "Reservas",
    contactPhones: [
      { phone: "4237-6276", phoneHref: "tel:+541142376276" },
      { phone: "+54 9 11 7026-7446", phoneHref: "tel:+5491170267446" },
    ],
    whatsappUrl: wsp("5491170267446", "Hola, quiero reservar pádel en el CVJ"),
    instagramUrl: "https://www.instagram.com/varelajrfutbol/",
    imageSrc: "/images/deportes/padel.png",
    imageAlt: "Canchas de pádel del Club Social Varela Junior",
    imageWidth: 1200,
    imageHeight: 800,
  },
  {
    slug: "basquet",
    title: "BÁSQUET",
    displayName: "Básquet",
    metaTitle: "Básquet | Club Social Varela Junior",
    metaDescription:
      "Básquet del Club Varela Juniors: categorías formativas, superior y femenino.",
    paragraphs: [
      "Básquet del Club Varela Juniors con categorías formativas, superior masculino y femenino.",
      "Entrenamientos repartidos en dos turnos semanales según categoría.",
    ],
    scheduleTitle: "Categorías y horarios",
    scheduleItems: [
      "Lun · Mié · Vie — Premini (U9) · 17 hs",
      "Lun · Mié · Vie — Mini (U11) y U13 · 18 hs",
      "Lun · Mié · Vie — U15 Flex · 19 hs",
      "Lun · Mié · Vie — U17 y U21 · 20 hs",
      "Lun · Mié · Vie — Superior · 21 hs",
      "Mar · Jue — Premini Femenino · 17 hs",
      "Mar · Jue — U13 Flex · 18 hs",
      "Mar · Jue — U17 / U21 Flex · 19 hs",
      "Mar · Jue — Superior Femenino · 20 hs",
      "Mar · Jue — Superior Flex · 21 hs",
    ],
    contactLabel: "Coordinadores",
    contactPhones: [
      { name: "Thiago", phone: "+54 9 11 6426-5720", phoneHref: "tel:+5491164265720" },
      { name: "Pablo", phone: "+54 9 11 3690-1392", phoneHref: "tel:+5491136901392" },
    ],
    whatsappUrl: wsp("5491164265720", "Hola Thiago, consulta por básquet del CVJ"),
    instagramUrl: "https://www.instagram.com/varelajuniorsbasquet/",
    imageSrc: PLACEHOLDER_IMG,
    imageAlt: "Básquet — Club Social Varela Junior",
    imageWidth: 1200,
    imageHeight: 800,
  },
  {
    slug: "voley",
    title: "VÓLEY",
    displayName: "Vóley",
    metaTitle: "Vóley | Club Social Varela Junior",
    metaDescription: "Vóley del Club Social Varela Junior.",
    paragraphs: [
      "Sumate al vóley del CVJ. Escribinos por WhatsApp para conocer horarios, categorías y costos.",
    ],
    contactLabel: "Consultas",
    contactPhone: "+54 9 11 5825-2571",
    contactPhoneHref: "tel:+5491158252571",
    whatsappUrl: wsp("5491158252571", "Hola, consulta por vóley del CVJ"),
    instagramUrl: "https://www.instagram.com/clubvarelajrvoley/",
    imageSrc: PLACEHOLDER_IMG,
    imageAlt: "Vóley — Club Social Varela Junior",
    imageWidth: 1200,
    imageHeight: 800,
  },
  {
    slug: "tenis",
    title: "TENIS",
    displayName: "Tenis",
    metaTitle: "Tenis · Varela Open | Club Social Varela Junior",
    metaDescription:
      "Tenis y Varela Open en el Club Social Varela Junior. Desde 2019 creciendo sin parar.",
    paragraphs: [
      "Tenis y comunidad alrededor del Varela Open: desde 2019 creciendo sin parar.",
      "Pasamos de 10 jugadores a una comunidad que vive el tenis como deporte, competencia y encuentro con amigos.",
    ],
    whatsappUrl: "",
    instagramUrl: "https://www.instagram.com/varelaopen/",
    imageSrc: "/images/deportes/tenis.png",
    imageAlt: "Tenis — Varela Open",
    imageWidth: 1200,
    imageHeight: 800,
  },
  {
    slug: "rugby",
    title: "RUGBY",
    displayName: "Rugby",
    metaTitle: "Rugby | Club Social Varela Junior",
    metaDescription: "Rugby del CVJ: infantiles, juveniles y primera.",
    paragraphs: [
      "Rugby del CVJ con tres etapas: Infantiles (nacidos entre 2012 y 2021), Juveniles (nacidos entre 2007 y 2011) y Primera.",
      "Juveniles entrena martes y jueves de 19 a 21 hs en La Capilla, con micro de ida y vuelta desde el centro de Varela.",
      "Seguinos en Instagram: @cvjrugby (Primera), @infantilcvjr (Infantiles) y @cvjuveniles (Juveniles).",
    ],
    scheduleTitle: "Entrenamientos",
    scheduleItems: [
      "Infantiles · 4 a 6 años — Miércoles 18 hs",
      "Infantiles · 7 a 11 años (M7 a M11) — Lunes y miércoles 18 hs",
      "Infantiles · 12 a 14 años (M12 · M13 · M14) — Lunes y miércoles 19 hs",
      "Juveniles (2007–2011) — Martes y jueves 19 a 21 hs · La Capilla",
    ],
    contactLabel: "Infantiles",
    contactPhone: "+54 9 11 3583-9110",
    contactPhoneHref: "tel:+5491135839110",
    whatsappUrl: wsp("5491135839110", "Hola, consulta por rugby infantiles del CVJ"),
    instagramUrl: "https://www.instagram.com/cvjrugby/",
    imageSrc: PLACEHOLDER_IMG,
    imageAlt: "Rugby — Club Social Varela Junior",
    imageWidth: 1200,
    imageHeight: 800,
  },
  {
    slug: "natacion",
    title: "NATACIÓN",
    displayName: "Natación",
    metaTitle: "Natación | Club Social Varela Junior",
    metaDescription:
      "Natación del Club Social Varela Junior: pileta libre, escuelita, adultos y aquagym.",
    paragraphs: [
      "Natación con turnos para jubilados, adultos, niños y aquagym. Consultá horarios actualizados por WhatsApp.",
      "Atención y consultas solamente por WhatsApp.",
    ],
    scheduleTitle: "Turnos (referencia semanal)",
    scheduleItems: [
      "Mañana · Pileta libre — 07:00 hs",
      "Mañana · Jubilados — 07:30 y 08:00 hs",
      "Mañana · Aquagym — 09:00 hs",
      "Mañana · Niños 7 a 12 años — 09:30 hs",
      "Mañana · Adultos — 10:30 y 11:30 hs",
      "Mañana · Niños 4 a 12 y adultos — 11:45 hs",
      "Tarde · Aquagym — 12:30 hs",
      "Tarde · Terapia acuática / entrenamiento — 13:00 hs",
      "Tarde · Adultos — 14:00 y 15:30 hs",
      "Tarde · Adultos y niños desde 5 años — 14:30 hs",
      "Tarde · Adultos y niños 4 a 12 — 16:30 hs",
      "Pileta libre — 17:00 a 19:00 hs",
    ],
    contactLabel: "Consultas (solo WhatsApp)",
    contactPhone: "+54 9 11 5095-0559",
    contactPhoneHref: "tel:+5491150950559",
    whatsappUrl: wsp("5491150950559", "Hola, consulta por natación del CVJ"),
    instagramUrl: "https://www.instagram.com/varelajuniornatacion/",
    imageSrc: "/images/deportes/natacion.png",
    imageAlt: "Natación — Club Social Varela Junior",
    imageWidth: 1200,
    imageHeight: 800,
  },
  {
    slug: "pelota-paleta",
    title: "PELOTA PALETA",
    displayName: "Pelota Paleta",
    metaTitle: "Pelota Paleta · El Trinquete | Club Social Varela Junior",
    metaDescription: "El Trinquete CVJ — pelota paleta de lunes a sábados.",
    paragraphs: [
      "El Trinquete CVJ — espacio dedicado a la pelota paleta para socios y visitantes.",
      "Abrimos de lunes a sábados de 11 a 24 hs.",
    ],
    scheduleTitle: "Horarios de apertura",
    scheduleItems: ["Lunes a sábados — 11 a 24 hs"],
    whatsappUrl: "",
    instagramUrl: "https://www.instagram.com/el.trinquete.cvj/",
    imageSrc: PLACEHOLDER_IMG,
    imageAlt: "Pelota Paleta — El Trinquete CVJ",
    imageWidth: 1200,
    imageHeight: 800,
  },
];

export function getDeporteBySlug(slug: string): DeportePageData | undefined {
  return deportes.find((d) => d.slug === slug);
}

export function getAllDeporteSlugs(): string[] {
  return deportes.map((d) => d.slug);
}

/** Lista compacta para Navbar / Footer. */
export const deportesNav: { label: string; href: string }[] = deportes.map((d) => ({
  label: d.displayName,
  href: `/deportes/${d.slug}`,
}));

/** Medidas recomendadas (documentación para quien edita fotos). */
export const DEPORTE_IMAGE_SPEC = {
  width: 1200,
  height: 800,
  retinaWidth: 1600,
  retinaHeight: 1067,
  ratio: "3:2",
  folder: "public/images/deportes/",
} as const;
