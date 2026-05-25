import { espacioHref } from "./espacios";

/**
 * Contenido de cada pestaña en /deportes/[slug].
 *
 * FOTO (panel derecho, 50% en desktop — object-cover):
 *   - Tamaño: 1200 × 1200 px (cuadrado)
 *   - Formato: JPG o WebP, calidad 80–85, ideal < 400 KB
 *   - Guardar en: public/images/deportes/[slug].jpg
 *
 * Redes: completá whatsappUrl e instagramUrl por actividad.
 */

export type DeportePageData = {
  slug: string;
  title: string;
  displayName: string;
  metaTitle: string;
  metaDescription: string;
  paragraphs: string[];
  scheduleTitle?: string;
  scheduleItems?: string[];
  contactLabel?: string;
  contactPhone?: string;
  contactPhoneHref?: string;
  contactPhones?: Array<{
    name?: string;
    phone: string;
    phoneHref: string;
  }>;
  whatsappUrl: string;
  instagramUrl: string;
  imageSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
};

const PLACEHOLDER_IMG = "/images/deportes/placeholder.svg";
const IMG = 1200;
const CLUB_IG = "https://www.instagram.com/clubsocialvarelajunior/";

function wsp(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/** 11-XXXX-XXXX → tel:+54911... */
function tel(phoneLocal: string): string {
  const digits = phoneLocal.replace(/\D/g, "");
  const full = digits.startsWith("549") ? digits : `549${digits}`;
  return `tel:+${full}`;
}

function phoneDisplay(phoneLocal: string): string {
  const d = phoneLocal.replace(/\D/g, "");
  if (d.length >= 10) {
    return `+54 9 11 ${d.slice(-8, -4)}-${d.slice(-4)}`;
  }
  return phoneLocal;
}

function wspFromLocal(phoneLocal: string, text: string): string {
  const digits = phoneLocal.replace(/\D/g, "");
  return wsp(digits.startsWith("549") ? digits : `549${digits}`, text);
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
      "Alquiler de canchas: también coordinamos fútbol, pádel, vóley y tenis nocturno por el mismo canal de reservas.",
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
      {
        name: "Alquiler de canchas",
        phone: phoneDisplay("1170267446"),
        phoneHref: tel("1170267446"),
      },
    ],
    whatsappUrl: wspFromLocal("1170267446", "Hola, quiero reservar fútbol 5 en el CVJ"),
    instagramUrl: "https://www.instagram.com/varelajrfutbol/",
    imageSrc: "/images/deportes/f5.jpg",
    imageAlt: "Fútbol 5 — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
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
      "Reservas y alquiler de canchas (fútbol, pádel, vóley y tenis nocturno) por teléfono o WhatsApp.",
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
      {
        name: "Alquiler de canchas",
        phone: phoneDisplay("1170267446"),
        phoneHref: tel("1170267446"),
      },
    ],
    whatsappUrl: wspFromLocal("1170267446", "Hola, quiero reservar pádel en el CVJ"),
    instagramUrl: "https://www.instagram.com/varelajrfutbol/",
    imageSrc: "/images/deportes/padel.jpg",
    imageAlt: "Canchas de pádel del Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "futbol-femenino",
    title: "FÚTBOL FEMENINO",
    displayName: "Fútbol Femenino",
    metaTitle: "Fútbol Femenino | Club Social Varela Junior",
    metaDescription: "Fútbol femenino del Club Social Varela Junior.",
    paragraphs: [
      "Equipo y escuela de fútbol femenino del Club Varela Juniors.",
      "Consultá por entrenamientos, categorías e inscripciones por teléfono o Instagram.",
    ],
    contactLabel: "Coordinación",
    contactPhone: phoneDisplay("1131519970"),
    contactPhoneHref: tel("1131519970"),
    whatsappUrl: wspFromLocal("1131519970", "Hola, consulta por fútbol femenino del CVJ"),
    instagramUrl: "https://www.instagram.com/clubvarelajuniorfem/",
    imageSrc: "/images/deportes/futbolfemenino.jpg",
    imageAlt: "Fútbol femenino — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "futbol-infantil",
    title: "FÚTBOL INFANTIL",
    displayName: "Fútbol Infantil",
    metaTitle: "Fútbol Infantil | Club Social Varela Junior",
    metaDescription: "Fútbol infantil del Club Social Varela Junior.",
    paragraphs: [
      "Formación y competencia de fútbol infantil en el Club Varela Juniors.",
      "Escribinos para conocer categorías, horarios de entrenamiento e inscripciones.",
    ],
    contactLabel: "Coordinación",
    contactPhone: phoneDisplay("1132948266"),
    contactPhoneHref: tel("1132948266"),
    whatsappUrl: wspFromLocal("1132948266", "Hola, consulta por fútbol infantil del CVJ"),
    instagramUrl: CLUB_IG,
    imageSrc: "/images/deportes/futbolinfantil.jpg",
    imageAlt: "Fútbol infantil — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "tenis",
    title: "TENIS",
    displayName: "Tenis",
    metaTitle: "Tenis · Varela Open | Club Social Varela Junior",
    metaDescription:
      "Tenis y Varela Open en el Club Social Varela Junior. Canchas y tenis nocturno.",
    paragraphs: [
      "Tenis y comunidad alrededor del Varela Open: desde 2019 creciendo sin parar.",
      "Pasamos de 10 jugadores a una comunidad que vive el tenis como deporte, competencia y encuentro con amigos.",
      "Alquiler de canchas (fútbol, pádel, vóley y tenis nocturno) — consultá disponibilidad por teléfono.",
    ],
    contactLabel: "Reservas · tenis nocturno",
    contactPhone: phoneDisplay("1170267446"),
    contactPhoneHref: tel("1170267446"),
    whatsappUrl: wspFromLocal("1170267446", "Hola, consulta por tenis / reserva de cancha en el CVJ"),
    instagramUrl: "https://www.instagram.com/varelaopen/",
    imageSrc: "/images/deportes/tenis.jpg",
    imageAlt: "Tenis — Varela Open",
    imageWidth: IMG,
    imageHeight: IMG,
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
    contactLabel: "Coordinación",
    contactPhones: [
      { name: "Thiago", phone: "+54 9 11 6426-5720", phoneHref: "tel:+5491164265720" },
      {
        name: "Pablo",
        phone: phoneDisplay("1136901392"),
        phoneHref: tel("1136901392"),
      },
    ],
    whatsappUrl: wspFromLocal("1136901392", "Hola, consulta por básquet del CVJ"),
    instagramUrl: "https://www.instagram.com/varelajuniorsbasquet/",
    imageSrc: "/images/deportes/basquet.jpg",
    imageAlt: "Básquet — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "voley",
    title: "VÓLEY",
    displayName: "Vóley",
    metaTitle: "Vóley | Club Social Varela Junior",
    metaDescription: "Vóley femenino, masculino y mixto en el Club Social Varela Junior.",
    paragraphs: [
      "Vóley en el CVJ: propuestas femeninas, masculinas y mixtas.",
      "Consultá horarios, categorías y alquiler de cancha por teléfono o WhatsApp.",
    ],
    contactLabel: "Consultas",
    contactPhone: phoneDisplay("1158252571"),
    contactPhoneHref: tel("1158252571"),
    whatsappUrl: wspFromLocal("1158252571", "Hola, consulta por vóley del CVJ"),
    instagramUrl: "https://www.instagram.com/clubvarelajrvoley/",
    imageSrc: "/images/deportes/voley.jpg",
    imageAlt: "Vóley — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "rugby",
    title: "RUGBY",
    displayName: "Rugby",
    metaTitle: "Rugby | Club Social Varela Junior",
    metaDescription: "Rugby del CVJ: infantiles, juveniles y superior.",
    paragraphs: [
      "Rugby del CVJ con tres etapas: Infantiles (nacidos entre 2012 y 2021), Juveniles (nacidos entre 2007 y 2011) y Superior.",
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
    contactLabel: "Coordinadores",
    contactPhones: [
      {
        name: "Infantiles",
        phone: phoneDisplay("1135839110"),
        phoneHref: tel("1135839110"),
      },
      {
        name: "Juveniles",
        phone: phoneDisplay("1138301431"),
        phoneHref: tel("1138301431"),
      },
      {
        name: "Superior",
        phone: phoneDisplay("1154104310"),
        phoneHref: tel("1154104310"),
      },
    ],
    whatsappUrl: wspFromLocal("1135839110", "Hola, consulta por rugby del CVJ"),
    instagramUrl: "https://www.instagram.com/cvjrugby/",
    imageSrc: "/images/deportes/rugby.jpg",
    imageAlt: "Rugby — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
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
      "Atención y consultas por teléfono o WhatsApp.",
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
    contactLabel: "Consultas",
    contactPhone: phoneDisplay("1150950559"),
    contactPhoneHref: tel("1150950559"),
    whatsappUrl: wspFromLocal("1150950559", "Hola, consulta por natación del CVJ"),
    instagramUrl: "https://www.instagram.com/varelajuniornatacion/",
    imageSrc: "/images/deportes/natacion.jpg",
    imageAlt: "Natación — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
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
    contactLabel: "El Trinquete",
    contactPhone: phoneDisplay("1130670696"),
    contactPhoneHref: tel("1130670696"),
    whatsappUrl: wspFromLocal("1130670696", "Hola, consulta por pelota paleta en El Trinquete CVJ"),
    instagramUrl: "https://www.instagram.com/el.trinquete.cvj/",
    imageSrc: "/images/deportes/pelotapaleta.jpg",
    imageAlt: "Pelota Paleta — El Trinquete CVJ",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "fight-club",
    title: "VARELA FIGHT CLUB",
    displayName: "Varela Fight Club",
    metaTitle: "Varela Fight Club | Club Social Varela Junior",
    metaDescription:
      "Boxeo, kick boxing, Muay Thai, K1, funcional y karate do en el Club Varela Juniors.",
    paragraphs: [
      "Varela Fight Club — espacio de artes marciales y entrenamiento funcional del CVJ.",
      "Disciplinas: boxeo, kick boxing, Muay Thai, K1, entrenamiento funcional y karate do.",
      "Consultá horarios, categorías y aranceles por teléfono o WhatsApp.",
    ],
    contactLabel: "Coordinación",
    contactPhone: phoneDisplay("1135637870"),
    contactPhoneHref: tel("1135637870"),
    whatsappUrl: wspFromLocal("1135637870", "Hola, consulta por Varela Fight Club del CVJ"),
    instagramUrl: CLUB_IG,
    imageSrc: "/images/deportes/boxeo.jpg",
    imageAlt: "Varela Fight Club — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "calidad",
    title: "GIMNASIO NO LIMITS",
    displayName: "Gimnasio",
    metaTitle: "Gimnasio No Limits | Club Social Varela Junior",
    metaDescription:
      "Gimnasio con aparatos No Limits en el Club Social Varela Junior.",
    paragraphs: [
      "Gimnasio No Limits (aparatos) en el Club Varela Juniors — entrenamiento con máquinas y sala de musculación.",
      "Consultá planes, horarios y aranceles por teléfono o WhatsApp.",
    ],
    contactLabel: "Gimnasio",
    contactPhone: phoneDisplay("1140724034"),
    contactPhoneHref: tel("1140724034"),
    whatsappUrl: wspFromLocal("1140724034", "Hola, consulta por el gimnasio No Limits del CVJ"),
    instagramUrl: CLUB_IG,
    imageSrc: "/images/deportes/gimnasio.jpg",
    imageAlt: "Gimnasio No Limits — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
];

export function getDeporteBySlug(slug: string): DeportePageData | undefined {
  return deportes.find((d) => d.slug === slug);
}

export function getAllDeporteSlugs(): string[] {
  return deportes.map((d) => d.slug);
}

export const deportesNav: { label: string; href: string }[] = deportes.map((d) => ({
  label: d.displayName,
  href: `/deportes/${d.slug}`,
}));

/**
 * Agrupaciones de la navegación principal.
 */
export type NavGroup = {
  label: string;
  href: string;
  items: { label: string; href: string }[];
};

function deporteHref(slug: string): string {
  return `/deportes/${slug}`;
}

export const deportesGrupos: NavGroup[] = [
  {
    label: "Deportes",
    href: "/deportes",
    items: [
      { label: "Fútbol Infantil", href: deporteHref("futbol-infantil") },
      { label: "Fútbol Femenino", href: deporteHref("futbol-femenino") },
      { label: "Básquet", href: deporteHref("basquet") },
      { label: "Vóley", href: deporteHref("voley") },
      { label: "Rugby", href: deporteHref("rugby") },
      { label: "Pelota Paleta · El Trinquete", href: deporteHref("pelota-paleta") },
    ],
  },
  {
    label: "Pileta & Gimnasio",
    href: "/deportes",
    items: [
      { label: "Natación / Aquagym", href: deporteHref("natacion") },
      { label: "Gimnasio No Limits", href: deporteHref("calidad") },
      { label: "Varela Fight Club", href: deporteHref("fight-club") },
    ],
  },
  {
    label: "Espacios",
    href: "/espacios/quincho",
    items: [
      { label: "Quincho", href: espacioHref("quincho") },
      { label: "Salón Multieventos", href: espacioHref("salon-multieventos") },
      { label: "Alquiler · Fútbol 5", href: deporteHref("futbol-5") },
      { label: "Alquiler · Pádel", href: deporteHref("padel") },
      { label: "Alquiler · Tenis", href: deporteHref("tenis") },
    ],
  },
];

export const DEPORTE_IMAGE_SPEC = {
  width: 1200,
  height: 1200,
  ratio: "1:1",
  folder: "public/images/deportes/",
} as const;
