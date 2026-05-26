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
  newsCategorySlug?: string;
  paragraphs: string[];
  scheduleTitle?: string;
  scheduleItems?: string[];
  scheduleGroups?: Array<{
    title: string;
    lines: string[];
    entries?: Array<{
      label: string;
      value: string;
    }>;
    groups?: Array<{
      title: string;
      lines: string[];
      entries?: Array<{
        label: string;
        value: string;
      }>;
    }>;
  }>;
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
    slug: "natacion-bebes",
    title: "NATACIÓN BEBÉS",
    displayName: "Natación Bebés",
    metaTitle: "Natación Bebés | Club Social Varela Junior",
    metaDescription:
      "Natación para bebés del Club Social Varela Junior con estimulación temprana, juego en el agua y clases acompañadas.",
    newsCategorySlug: "natacion",
    paragraphs: [
      "Clases de natación para bebés orientadas al juego, la diversión en el agua y la estimulación temprana.",
      "La propuesta se realiza con mamá o papá, en un entorno cuidado para trabajar seguridad, confianza y vínculo con el agua.",
      "Contamos con profesores especializados. Atención y consultas por Instagram o WhatsApp.",
    ],
    scheduleTitle: "Horarios",
    scheduleGroups: [
      {
        title: "Martes y jueves",
        lines: ["13:00 hs"],
      },
      {
        title: "Sábados",
        lines: ["12:30 hs"],
      },
    ],
    contactLabel: "Consultas",
    contactPhone: phoneDisplay("1150950559"),
    contactPhoneHref: tel("1150950559"),
    whatsappUrl: wspFromLocal("1150950559", "Hola, consulta por natación bebés del CVJ"),
    instagramUrl: "https://www.instagram.com/varelajuniornatacion/",
    imageSrc: "/images/deportes/natacionbebes.jpg",
    imageAlt: "Natación Bebés — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "natacion-ninos",
    title: "NATACIÓN NIÑOS",
    displayName: "Natación Niños",
    metaTitle: "Natación Niños | Club Social Varela Junior",
    metaDescription:
      "Natación niños del Club Social Varela Junior: escuelita desde 3 años, grupos por edad y niveles.",
    newsCategorySlug: "natacion",
    paragraphs: [
      "Natación para niños y niñas desde los 3 años, con grupos organizados por edad y nivel.",
      "La propuesta incluye categorías iniciales, intermedias y avanzadas, con distintos días y horarios según cada grupo.",
      "Atención y consultas por Instagram o WhatsApp.",
    ],
    scheduleTitle: "Horarios de natación niños",
    scheduleGroups: [
      {
        title: "De 3 años",
        lines: [],
        entries: [
          { label: "Martes y jueves", value: "14:30 hs" },
          { label: "Sábados", value: "14:30 hs" },
        ],
      },
      {
        title: "De 4 a 6 años",
        lines: [],
        entries: [
          {
            label: "Lunes, miércoles y viernes",
            value: "14:30, 15:30, 16:30, 17:30, 18:30 y 19:30 hs — Inicial",
          },
          {
            label: "Martes y jueves",
            value: "15:30, 16:30, 17:30, 18:30 y 19:30 hs — Inicial",
          },
        ],
      },
      {
        title: "De 7 a 12 años",
        lines: [],
        entries: [
          { label: "Lunes, miércoles y viernes", value: "14:15 y 15:15 hs — Inicial" },
          {
            label: "Lunes, miércoles y viernes",
            value: "16:15, 18:00 y 19:00 hs — Inicial, Intermedio y Avanzado",
          },
          { label: "Martes y jueves", value: "14:45 hs — Inicial" },
          {
            label: "Martes y jueves",
            value: "15:45, 17:45 y 18:45 hs — Inicial, Intermedio y Avanzado",
          },
          { label: "Sábados", value: "09:30 hs — Inicial" },
        ],
      },
      {
        title: "De 4 a 12 años",
        lines: [],
        entries: [
          { label: "Lunes, miércoles y viernes", value: "09:15 hs — Inicial" },
          {
            label: "Martes y jueves",
            value: "09:45 hs — Inicial, Intermedio y Avanzado",
          },
          {
            label: "Sábados",
            value: "10:30, 11:30 y 15:30 hs — Inicial, Intermedio y Avanzado",
          },
          { label: "Sábados", value: "16:30 hs — Inicial" },
          { label: "Sábados", value: "17:30 hs" },
        ],
      },
    ],
    contactLabel: "Consultas",
    contactPhone: phoneDisplay("1150950559"),
    contactPhoneHref: tel("1150950559"),
    whatsappUrl: wspFromLocal("1150950559", "Hola, consulta por natación niños del CVJ"),
    instagramUrl: "https://www.instagram.com/varelajuniornatacion/",
    imageSrc: "/images/deportes/natacionninos.jpg",
    imageAlt: "Natación Niños — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "natacion",
    title: "NATACIÓN ADULTOS",
    displayName: "Natación Adultos",
    metaTitle: "Natación Adultos | Club Social Varela Junior",
    metaDescription:
      "Natación adultos del Club Social Varela Junior con turnos semanales y niveles Inicial, Intermedio y Avanzado.",
    paragraphs: [
      "Natación para adultos con distintos turnos semanales en pileta, pensados para entrenamiento, aprendizaje y continuidad en el agua.",
      "Todos los turnos contemplan los niveles Inicial, Intermedio y Avanzado.",
      "Atención y consultas por Instagram o WhatsApp.",
    ],
    scheduleTitle: "Horarios",
    scheduleGroups: [
      {
        title: "Lunes, miércoles y viernes",
        entries: [
          { label: "Horario", value: "07:00, 09:00, 11:00, 14:00, 15:00, 19:15, 20:15 y 21:15 hs" },
        ],
        lines: [],
      },
      {
        title: "Martes y jueves",
        entries: [
          { label: "Horario", value: "07:00, 10:00, 11:00, 14:00, 15:00, 17:00, 18:00, 19:00 y 20:00 hs" },
        ],
        lines: [],
      },
      {
        title: "Sábados",
        entries: [
          { label: "Horario", value: "10:00, 11:00, 14:00, 15:00, 16:00 y 17:00 hs" },
        ],
        lines: [],
      },
      {
        title: "Niveles",
        lines: ["Todos los turnos: Inicial · Intermedio · Avanzado"],
      },
    ],
    contactLabel: "Consultas",
    contactPhone: phoneDisplay("1150950559"),
    contactPhoneHref: tel("1150950559"),
    whatsappUrl: wspFromLocal("1150950559", "Hola, consulta por natación adultos del CVJ"),
    instagramUrl: "https://www.instagram.com/varelajuniornatacion/",
    imageSrc: "/images/deportes/natacionadultos.jpg",
    imageAlt: "Natación Adultos — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "natacion-master",
    title: "NATACIÓN MASTER",
    displayName: "Natación Master",
    metaTitle: "Natación Master | Club Social Varela Junior",
    metaDescription:
      "Natación Master del Club Social Varela Junior con turnos semanales para entrenamiento de nadadores master.",
    newsCategorySlug: "natacion",
    paragraphs: [
      "Natación Master en el CVJ: turnos pensados para entrenamiento continuo, técnica y resistencia para nadadores con experiencia.",
      "Los horarios funcionan en paralelo al cronograma general de pileta y se ajustan al calendario de la temporada.",
      "Atención y consultas por Instagram o WhatsApp.",
    ],
    scheduleTitle: "Horarios de Master",
    scheduleGroups: [
      {
        title: "Lunes, miércoles y viernes",
        entries: [
          { label: "Horario", value: "12:30 hs" },
        ],
        lines: [],
      },
      {
        title: "Martes y jueves",
        entries: [
          { label: "Horario", value: "12:30 hs" },
          { label: "Horario", value: "21:00 hs (Compartido con Adultos)" },
        ],
        lines: [],
      },
      {
        title: "Sábados",
        entries: [
          { label: "Horario", value: "12:30 hs" },
        ],
        lines: [],
      },
    ],
    contactLabel: "Consultas",
    contactPhone: phoneDisplay("1150950559"),
    contactPhoneHref: tel("1150950559"),
    whatsappUrl: wspFromLocal("1150950559", "Hola, consulta por natación master del CVJ"),
    instagramUrl: "https://www.instagram.com/varelajuniornatacion/",
    imageSrc: "/images/deportes/natacionmaster.jpg",
    imageAlt: "Natación Master — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "natacion-jubilados",
    title: "NATACIÓN JUBILADOS",
    displayName: "Natación Jubilados",
    metaTitle: "Natación Jubilados | Club Social Varela Junior",
    metaDescription:
      "Natación jubilados del Club Social Varela Junior con turnos semanales en pileta.",
    newsCategorySlug: "natacion",
    paragraphs: [
      "Natación para jubilados con turnos semanales pensados para moverse, mantenerse activos y disfrutar de la pileta en un entorno cuidado.",
      "Esta página reúne solo los horarios que en la planilla figuran específicamente como Natación.",
      "Atención y consultas por Instagram o WhatsApp.",
    ],
    scheduleTitle: "Horarios de natación jubilados",
    scheduleGroups: [
      {
        title: "Lunes, miércoles y viernes",
        entries: [
          { label: "Horario", value: "10:00 y 11:00 hs" },
        ],
        lines: [],
      },
      {
        title: "Martes y jueves",
        entries: [
          { label: "Horario", value: "07:45, 11:00, 14:00 y 15:00 hs" },
        ],
        lines: [],
      },
    ],
    contactLabel: "Consultas",
    contactPhone: phoneDisplay("1150950559"),
    contactPhoneHref: tel("1150950559"),
    whatsappUrl: wspFromLocal("1150950559", "Hola, consulta por natación jubilados del CVJ"),
    instagramUrl: "https://www.instagram.com/varelajuniornatacion/",
    imageSrc: "/images/deportes/natacionjubilados.jpg",
    imageAlt: "Natación Jubilados — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "aqua-gym",
    title: "AQUA GYM",
    displayName: "Aqua Gym",
    metaTitle: "Aqua Gym | Club Social Varela Junior",
    metaDescription:
      "Aqua Gym del Club Social Varela Junior con un enfoque actual: fitness híbrido, cardio y trabajo de fuerza en el agua.",
    paragraphs: [
      "En el CVJ adaptamos el Aqua Gym tradicional a una propuesta más actual, dinámica y guiada dentro del agua.",
      "Trabajamos fitness híbrido, acuática HIT de alta intensidad con cardio, fuerza en el agua y variantes para entrenar dentro y fuera de la pileta.",
      "Es una actividad pensada para moverse, entrenar y disfrutar, con mucha música y diversión. Consultá vacantes y horarios por WhatsApp.",
    ],
    scheduleTitle: "Turnos de Aqua Gym",
    scheduleGroups: [
      {
        title: "Lunes",
        lines: [
          "Pileta chica — 07:00, 08:15, 11:15, 12:15, 13:15, 17:15, 18:00 y 19:15 hs",
        ],
      },
      {
        title: "Martes",
        lines: [
          "Pileta chica — 06:15, 07:15, 08:15, 12:00, 13:00 y 17:00 hs",
          "Pileta grande — 07:40, 08:00, 09:00 y 09:15 hs",
        ],
      },
      {
        title: "Miércoles",
        lines: [
          "Pileta chica — 07:00, 08:15, 11:15, 12:15, 13:15, 17:15, 18:00 y 19:15 hs",
        ],
      },
      {
        title: "Jueves",
        lines: [
          "Pileta chica — 06:15, 07:15, 08:15, 12:00, 13:00 y 17:00 hs",
          "Pileta grande — 07:40, 08:00, 09:00 y 09:15 hs",
        ],
      },
      {
        title: "Viernes",
        lines: [
          "Pileta chica — 07:00, 08:15, 11:15, 12:15, 13:15, 17:15, 18:00 y 19:15 hs",
        ],
      },
      {
        title: "Sábados",
        lines: [
          "Pileta grande — 09:00 y 12:00 hs",
        ],
      },
    ],
    contactLabel: "Consultas",
    contactPhone: phoneDisplay("1150950559"),
    contactPhoneHref: tel("1150950559"),
    whatsappUrl: wspFromLocal("1150950559", "Hola, consulta por Aqua Gym del CVJ"),
    instagramUrl: "https://www.instagram.com/varelajuniornatacion/",
    imageSrc: "/images/deportes/aquagym.jpg",
    imageAlt: "Aqua Gym — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "terapia-acuatica",
    title: "TERAPIA ACUÁTICA",
    displayName: "Terapia Acuática",
    metaTitle: "Terapia Acuática | Club Social Varela Junior",
    metaDescription:
      "Terapia acuática en el Club Social Varela Junior con turnos semanales en pileta y seguimiento según cada necesidad.",
    paragraphs: [
      "La terapia acuática o hidroterapia se realiza dentro del agua con fines terapéuticos en distintos tratamientos de patologías, lesiones y también como actividad física de bajo impacto.",
      "En el CVJ está orientada a personas que necesitan mejorar movilidad, coordinación, fuerza o acompañamiento físico en un entorno cuidado.",
      "Consultá evaluación previa, indicaciones y cupos disponibles por WhatsApp antes de asistir.",
    ],
    scheduleTitle: "Horarios de terapia acuática",
    scheduleGroups: [
      {
        title: "Lunes, miércoles y viernes",
        lines: ["10:15 a 11:15 hs"],
      },
      {
        title: "Sábado",
        lines: ["13:15 a 14:15 hs", "14:15 a 15:15 hs"],
      },
    ],
    contactLabel: "Consultas",
    contactPhone: phoneDisplay("1150950559"),
    contactPhoneHref: tel("1150950559"),
    whatsappUrl: wspFromLocal("1150950559", "Hola, consulta por terapia acuática del CVJ"),
    instagramUrl: "https://www.instagram.com/varelajuniornatacion/",
    imageSrc: "/images/deportes/terapiaacuatica.jpg",
    imageAlt: "Terapia Acuática — Club Social Varela Junior",
    imageWidth: IMG,
    imageHeight: IMG,
  },
  {
    slug: "pileta-libre",
    title: "PILETA LIBRE",
    displayName: "Pileta Libre",
    metaTitle: "Pileta Libre | Club Social Varela Junior",
    metaDescription:
      "Pileta libre del Club Social Varela Junior con turnos para entrenamiento y uso recreativo.",
    paragraphs: [
      "La pileta libre del CVJ está pensada para quienes quieren nadar por su cuenta, entrenar o disfrutar del agua en franjas horarias específicas.",
      "Contamos con turnos de mañana y tarde, sujetos a disponibilidad y al cronograma general de actividades de la pileta.",
      "Antes de asistir, consultá por cupos, apto médico y condiciones de ingreso.",
    ],
    scheduleTitle: "Horarios de pileta libre",
    scheduleGroups: [
      {
        title: "Lunes a viernes",
        lines: [
          "06:00 a 08:00 hs",
          "11:00 a 14:00 hs",
          "16:00 a 17:00 hs",
        ],
      },
      {
        title: "Sábados",
        lines: [
          "07:00 a 09:00 hs",
          "15:00 a 18:00 hs",
        ],
      },
    ],
    contactLabel: "Consultas",
    contactPhone: phoneDisplay("1150950559"),
    contactPhoneHref: tel("1150950559"),
    whatsappUrl: wspFromLocal("1150950559", "Hola, consulta por pileta libre del CVJ"),
    instagramUrl: "https://www.instagram.com/varelajuniornatacion/",
    imageSrc: "/images/deportes/pilitalibre.jpg",
    imageAlt: "Pileta Libre — Club Social Varela Junior",
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
      { label: "Pelota Paleta", href: deporteHref("pelota-paleta") },
      { label: "Varela Fight Club", href: deporteHref("fight-club") },
      { label: "Gimnasio", href: deporteHref("calidad") },
    ],
  },
  {
    label: "Pileta",
    href: "/deportes",
    items: [
      { label: "Natación Bebés", href: deporteHref("natacion-bebes") },
      { label: "Natación Niños", href: deporteHref("natacion-ninos") },
      { label: "Natación Adultos", href: deporteHref("natacion") },
      { label: "Natación Master", href: deporteHref("natacion-master") },
      { label: "Natación Jubilados", href: deporteHref("natacion-jubilados") },
      { label: "Aqua Gym", href: deporteHref("aqua-gym") },
      { label: "Terapia Acuática", href: deporteHref("terapia-acuatica") },
      { label: "Pileta Libre", href: deporteHref("pileta-libre") },
    ],
  },
  {
    label: "Alquileres",
    href: "/espacios/quincho",
    items: [
      { label: "Salón Multieventos", href: espacioHref("salon-multieventos") },
      { label: "Quincho", href: espacioHref("quincho") },
      { label: "Tenis", href: deporteHref("tenis") },
      { label: "Pádel", href: deporteHref("padel") },
      { label: "Fútbol 5", href: deporteHref("futbol-5") },
    ],
  },
];

export const DEPORTE_IMAGE_SPEC = {
  width: 1200,
  height: 1200,
  ratio: "1:1",
  folder: "public/images/deportes/",
} as const;
