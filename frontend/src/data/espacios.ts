/**
 * Páginas de espacios para alquiler (quincho, salón multieventos).
 * Fotos: public/images/espacios/[slug].jpg — 1200×1200, mismo criterio que deportes.
 */

export type EspacioPageData = {
  slug: string;
  title: string;
  displayName: string;
  metaTitle: string;
  metaDescription: string;
  paragraphs: string[];
  scheduleTitle?: string;
  scheduleItems?: string[];
  featuresTitle?: string;
  features?: string[];
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
  reservaHref: string;
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

export const espacios: EspacioPageData[] = [
  {
    slug: "quincho",
    title: "QUINCHO",
    displayName: "Quincho",
    metaTitle: "Quincho | Alquileres | Club Social Varela Junior",
    metaDescription:
      "Alquilá el quincho del Club Social Varela Junior para cumpleaños, reuniones y encuentros al aire libre.",
    paragraphs: [
      "El quincho del CVJ es el lugar ideal para celebrar cumpleaños, asados con amigos o reuniones familiares en un entorno verde y tranquilo del club.",
      "Incluye parrilla, mesas, electricidad y acceso a baños del predio. Consultá disponibilidad, capacidad y aranceles por teléfono o WhatsApp.",
    ],
    featuresTitle: "Incluye",
    features: [
      "Parrilla y mesas",
      "Espacio al aire libre con sombra",
      "Electricidad",
      "Baños del club",
      "Estacionamiento en el predio",
    ],
    scheduleTitle: "Reservas",
    scheduleItems: [
      "Turnos de mañana, tarde y noche según disponibilidad",
      "Socios y no socios — consultá condiciones",
      "Se recomienda reservar con anticipación los fines de semana",
    ],
    contactLabel: "Reservas y consultas",
    contactPhones: [
      { phone: "4237-6276", phoneHref: "tel:+541142376276" },
      {
        name: "WhatsApp",
        phone: phoneDisplay("1170267446"),
        phoneHref: tel("1170267446"),
      },
    ],
    whatsappUrl: wspFromLocal("1170267446", "Hola, quiero consultar por alquiler del quincho en el CVJ"),
    instagramUrl: CLUB_IG,
    reservaHref: "/contacto?asunto=quincho",
    imageSrc: PLACEHOLDER_IMG,
    imageAlt: "Quincho — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "salon-multieventos",
    title: "SALÓN MULTIEVENTOS",
    displayName: "Salón Multieventos",
    metaTitle: "Salón Multieventos | Alquileres | Club Social Varela Junior",
    metaDescription:
      "Salón multieventos del Club Social Varela Junior para fiestas, reuniones, capacitaciones y eventos privados.",
    paragraphs: [
      "Salón cerrado y climatizado para eventos sociales, empresariales o institucionales: cumpleaños, fiestas de fin de año, charlas y encuentros deportivos.",
      "Consultá capacidad, mobiliario disponible, sonido, catering externo y fechas libres con la administración del club.",
    ],
    featuresTitle: "Ideal para",
    features: [
      "Cumpleaños y fiestas",
      "Reuniones y capacitaciones",
      "Eventos institucionales del club",
      "Presentaciones y encuentros cerrados",
    ],
    scheduleTitle: "Reservas",
    scheduleItems: [
      "Disponibilidad según calendario del club",
      "Aranceles diferenciados para socios",
      "Coordinación de montaje con al menos 7 días de anticipación",
    ],
    contactLabel: "Reservas y consultas",
    contactPhones: [
      { phone: "4237-6276", phoneHref: "tel:+541142376276" },
      {
        name: "WhatsApp",
        phone: phoneDisplay("1170267446"),
        phoneHref: tel("1170267446"),
      },
    ],
    whatsappUrl: wspFromLocal(
      "1170267446",
      "Hola, quiero consultar por alquiler del salón multieventos en el CVJ",
    ),
    instagramUrl: CLUB_IG,
    reservaHref: "/contacto?asunto=salon",
    imageSrc: PLACEHOLDER_IMG,
    imageAlt: "Salón Multieventos — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
];

export function getEspacioBySlug(slug: string): EspacioPageData | undefined {
  return espacios.find((e) => e.slug === slug);
}

export function getAllEspacioSlugs(): string[] {
  return espacios.map((e) => e.slug);
}

export function espacioHref(slug: string): string {
  return `/espacios/${slug}`;
}
