const fs = require('fs');
const { randomUUID } = require('crypto');

const newsData = [
  {
    title: "¡Arranca el Torneo Relámpago de Fútbol 5!",
    slug: "torneo-relampago-futbol-5",
    summary: "Este fin de semana te esperamos para vivir el torneo de Fútbol 5 más emocionante de la zona sur.",
    body: "<p>Vení con tu equipo y demostrá quién manda en la cancha. El torneo relámpago de Fútbol 5 se jugará este sábado desde las 10:00 AM.</p><p>Habrá premios para los tres primeros puestos y buffet abierto todo el día. ¡No te quedes afuera!</p>",
    categorySlug: "futbol-5",
    image: "https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=1600&q=80",
    daysAgo: 0
  },
  {
    title: "Inauguración de las nuevas canchas de Pádel",
    slug: "inauguracion-canchas-padel",
    summary: "Seguimos invirtiendo en infraestructura: ya están listas las nuevas canchas profesionales de blindex.",
    body: "<p>Con mucho orgullo anunciamos que ya están habilitadas las dos nuevas canchas de Pádel profesionales. Las mismas cuentan con césped sintético de última generación e iluminación LED.</p><p>Podés reservar tu turno desde hoy mismo en la secretaría del club.</p>",
    categorySlug: "padel",
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1f4?auto=format&fit=crop&w=1600&q=80",
    daysAgo: 1
  },
  {
    title: "Arrancan las clases de Aquagym y Natación",
    slug: "clases-aquagym-natacion",
    summary: "La pileta cubierta ya está a temperatura ideal para arrancar la temporada de invierno.",
    body: "<p>Este lunes comienzan oficialmente las clases de natación para todas las edades y niveles. Además, sumamos nuevos horarios de Aquagym por la mañana y la tarde.</p><p>Consultá la grilla de horarios en recepción. Cupos limitados.</p>",
    categorySlug: "natacion",
    image: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1600&q=80",
    daysAgo: 2
  },
  {
    title: "Clínica intensiva de Básquet para juveniles",
    slug: "clinica-basquet-juveniles",
    summary: "Invitamos a todos los chicos y chicas de entre 12 y 17 años a participar de nuestra clínica de básquet.",
    body: "<p>El próximo domingo contaremos con la presencia de entrenadores de primer nivel que dictarán una clínica intensiva de fundamentos tácticos y técnicos.</p><p>La actividad es gratuita para socios. Requiere inscripción previa.</p>",
    categorySlug: "basquet",
    image: "https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1600&q=80",
    daysAgo: 3
  },
  {
    title: "El equipo de Hockey Femenino clasifica a la final",
    slug: "hockey-femenino-final",
    summary: "Nuestras chicas de la primera división lograron un triunfo histórico el pasado fin de semana.",
    body: "<p>En un partido vibrante, el equipo mayor femenino de hockey venció por 2 a 1 en las semifinales y se aseguró un lugar en la gran final del torneo regional.</p><p>Felicitamos a las jugadoras y al cuerpo técnico por el enorme esfuerzo.</p>",
    categorySlug: "hockey",
    image: "https://images.unsplash.com/photo-1515787366009-7cbdd2dc5874?auto=format&fit=crop&w=1600&q=80",
    daysAgo: 4
  },
  {
    title: "Nueva sala de Musculación y Fitness",
    slug: "nueva-sala-musculacion",
    summary: "Renovamos completamente las máquinas y pesas del gimnasio para brindarte un mejor servicio.",
    body: "<p>Ya podés venir a probar las nuevas cintas, elípticos y máquinas de fuerza que instalamos en el gimnasio del club. Además, ampliamos el sector de peso libre.</p><p>Recordá traer toalla y botella de agua personal.</p>",
    categorySlug: null,
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80",
    daysAgo: 5
  },
  {
    title: "Clases de Yoga al aire libre",
    slug: "yoga-aire-libre",
    summary: "Aprovechamos los días lindos de primavera para relajar cuerpo y mente en los jardines del club.",
    body: "<p>Todos los martes y jueves a las 18:00 hs mudamos las clases de Yoga a los espacios verdes del club. Traé tu mat y conectate con la naturaleza.</p><p>Actividad apta para todos los niveles, no requiere experiencia previa.</p>",
    categorySlug: null,
    image: "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=1600&q=80",
    daysAgo: 6
  },
  {
    title: "Resultados del Torneo de Atletismo",
    slug: "resultados-atletismo",
    summary: "Nuestros representantes brillaron en el encuentro interclubes de atletismo este mes.",
    body: "<p>Con gran orgullo compartimos los excelentes resultados obtenidos por nuestra escuela de atletismo. Logramos sumar medallas en las disciplinas de velocidad, salto en largo y lanzamiento de jabalina.</p>",
    categorySlug: "atletismo",
    image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1600&q=80",
    daysAgo: 7
  },
  {
    title: "Inscripciones abiertas para la Liga de Vóley",
    slug: "inscripciones-voley",
    summary: "Armá tu equipo y participá del torneo mixto de Vóley que organiza el club.",
    body: "<p>Están abiertas las inscripciones para el torneo anual de Vóley mixto. Podés anotar a tu equipo en la secretaría hasta el viernes 15.</p><p>Los partidos se jugarán los sábados por la tarde en el gimnasio principal.</p>",
    categorySlug: "voley",
    image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1600&q=80",
    daysAgo: 8
  },
  {
    title: "Remodelación de la Cafetería",
    slug: "remodelacion-cafeteria",
    summary: "Terminamos las obras en el sector gastronómico para ofrecer un espacio moderno y acogedor.",
    body: "<p>Te invitamos a conocer el nuevo buffet / cafetería del club, que ahora cuenta con sector de sillones, WiFi de alta velocidad y un menú renovado con opciones saludables.</p><p>Ideal para el tercer tiempo o para esperar a los chicos mientras entrenan.</p>",
    categorySlug: null,
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1600&q=80",
    daysAgo: 9
  },
  {
    title: "Colonia de Verano: ¡Ya podés reservar tu lugar!",
    slug: "colonia-verano",
    summary: "Asegurá la vacante para la mejor temporada de verano de la ciudad.",
    body: "<p>Se abrió la inscripción temprana para la Colonia de Verano Varela Junior. Actividades recreativas, natación, juegos al aire libre y mucho más para chicos de 4 a 12 años.</p><p>Hay descuentos exclusivos pagando en efectivo antes del 30 de noviembre.</p>",
    categorySlug: null,
    image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=1600&q=80",
    daysAgo: 10
  },
  {
    title: "Torneo Interno de Tenis Dobles",
    slug: "torneo-interno-tenis-dobles",
    summary: "Llega el torneo más divertido del año. Formá pareja y competí en nuestro clásico torneo interno.",
    body: "<p>El próximo fin de semana se disputará el torneo de Tenis Dobles para las categorías A, B y C. Habrá choripaneada de cierre y entrega de trofeos.</p><p>Anotate con tu pareja en secretaría o buscando el formulario online en nuestras redes.</p>",
    categorySlug: "tenis",
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1f4?auto=format&fit=crop&w=1600&q=80",
    daysAgo: 11
  }
];

let sql = `-- Script para limpiar y volver a llenar noticias de prueba con imágenes.

DO $$
DECLARE
`;

// Declarar variables de categoría
const categories = Array.from(new Set(newsData.map(n => n.categorySlug).filter(Boolean)));
categories.forEach((cat, i) => {
  sql += `  cat_${cat.replace(/-/g, '_')} uuid;\n`;
});

sql += `BEGIN
  -- 1. Limpiar noticias anteriores (por cascade se borran imágenes y links)
  DELETE FROM public.news;

  -- 2. Buscar IDs de categorías existentes
`;
categories.forEach(cat => {
  sql += `  SELECT id INTO cat_${cat.replace(/-/g, '_')} FROM public.news_categories WHERE slug = '${cat}' LIMIT 1;\n`;
});

sql += `\n  -- 3. Insertar Noticias e Imágenes\n`;

newsData.forEach((news, i) => {
  const newsId = randomUUID();
  const imageId = randomUUID();
  sql += `
  -- NOTICIA: ${news.title}
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '${newsId}',
    '${news.slug}',
    '${news.title.replace(/'/g, "''")}',
    '${news.summary.replace(/'/g, "''")}',
    '${news.body.replace(/'/g, "''")}',
    true,
    now() - interval '${news.daysAgo} days',
    now() - interval '${news.daysAgo} days',
    now() - interval '${news.daysAgo} days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    '${imageId}',
    '${newsId}',
    '${news.image}',
    true,
    0
  );
`;
  if (news.categorySlug) {
    const catVar = `cat_${news.categorySlug.replace(/-/g, '_')}`;
    sql += `
  IF ${catVar} IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('${newsId}', ${catVar});
  END IF;
`;
  }
});

sql += `\nEND $$;\n`;

fs.writeFileSync('backend/supabase/seed_noticias_staging.sql', sql);
console.log("SQL script generated successfully!");
