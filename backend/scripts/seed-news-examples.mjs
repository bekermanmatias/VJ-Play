/**
 * Crea 6 noticias de ejemplo (publicadas) usando la API admin del backend.
 *
 * Requisitos:
 *   - El backend debe estar corriendo en el host indicado (default: http://localhost:4000).
 *   - Debe existir ADMIN_SECRET en backend/.env.
 *   - La migración 012_news.sql debe estar aplicada.
 *
 * Uso:
 *   node scripts/seed-news-examples.mjs                 # crea (sin imágenes) sin reemplazar
 *   node scripts/seed-news-examples.mjs --reset         # primero borra noticias previas con los slugs de ejemplo
 *   node scripts/seed-news-examples.mjs --api http://localhost:4000
 *
 * Nota: este script no sube imágenes. Para fotos, usar el admin web (/admin/noticias).
 */
import { config as loadDotenv } from "dotenv";
import { join } from "node:path";

loadDotenv({ path: join(process.cwd(), ".env") });

const apiBase = (() => {
  const idx = process.argv.indexOf("--api");
  if (idx > -1 && process.argv[idx + 1]) return process.argv[idx + 1].replace(/\/$/, "");
  return (process.env.PUBLIC_REPLAY_API_BASE ?? "http://localhost:4000").replace(/\/$/, "");
})();
const adminSecret = (process.env.ADMIN_SECRET ?? "").trim();
const reset = process.argv.includes("--reset");

if (!adminSecret) {
  console.error("[seed-news] Falta ADMIN_SECRET en backend/.env");
  process.exit(1);
}

const EXAMPLES = [
  {
    slug: "campeonato-padel-otono-2026",
    title: "Campeonato de Pádel Otoño 2026: arrancan las inscripciones",
    summary:
      "Se viene el clásico torneo de pádel del club, con categorías para todos los niveles y premios para los finalistas.",
    body: `Las inscripciones para el Campeonato de Pádel Otoño 2026 ya están abiertas en recepción y por WhatsApp.

Habrá categorías 4ta, 5ta, 6ta y mixto, con cupos limitados para asegurar buenos partidos. El cuadro principal se juega los fines de semana, con días de semana reservados para reprogramaciones.

Costo de inscripción: $X por jugador. Incluye obsequio del club y premios para los primeros puestos.`,
    author: "Subcomisión de Pádel",
    categorySlugs: ["padel"],
  },
  {
    slug: "futbol-femenino-suma-categoria-sub-15",
    title: "Fútbol Femenino: nueva categoría Sub-15",
    summary:
      "A partir de junio, el club abre la categoría Sub-15 de fútbol femenino. Probate cualquier miércoles a las 18 h.",
    body: `Seguimos haciendo crecer el fútbol femenino del Varela Junior. Desde junio sumamos la categoría Sub-15, con entrenamientos los lunes, miércoles y viernes en cancha de F5.

Las pruebas son los miércoles a las 18 h. No hace falta inscripción previa: vení con ropa cómoda, botines y ganas de jugar.

Cualquier consulta, escribinos por WhatsApp.`,
    author: "Subcomisión de Fútbol Femenino",
    categorySlugs: ["futbol-femenino"],
  },
  {
    slug: "obras-pintura-vestuarios-mayo-2026",
    title: "Obras: pintura y mejoras en los vestuarios",
    summary:
      "Durante mayo se realizan trabajos de pintura y refacción en los vestuarios principales. Habilitamos vestuarios alternativos.",
    body: `Como parte del plan de mejoras 2026, esta semana arrancaron las obras de pintura y refacción en los vestuarios principales del club.

Mientras duren los trabajos (aproximadamente 10 días), están habilitados los vestuarios alternativos del sector norte. Pedimos disculpas por las molestias.

Cualquier inconveniente, acercate a recepción para que te ayudemos.`,
    author: "Comisión Directiva",
    categorySlugs: ["institucional"],
  },
  {
    slug: "torneo-interno-futbol-5-equipos",
    title: "Torneo interno de Fútbol 5: 12 equipos confirmados",
    summary:
      "Ya están confirmados los 12 equipos que jugarán el torneo interno de F5. Conocé el fixture y los horarios.",
    body: `Quedaron confirmados los 12 equipos del próximo torneo interno de Fútbol 5 del club. La modalidad es por puntos en zonas, con los mejores avanzando a semifinales.

Los partidos se juegan los martes y jueves a partir de las 20 h, en las dos canchas principales. El fixture lo podés ver en cartelera o pedírselo a Federico por WhatsApp.

¡Mucha suerte a todos!`,
    author: "Subcomisión de Fútbol 5",
    categorySlugs: ["futbol-5"],
  },
  {
    slug: "natacion-clases-invierno",
    title: "Natación: inscripciones abiertas para clases de invierno",
    summary:
      "Las clases de natación de invierno empiezan el lunes 1 de junio. Hay horarios para niños, adultos y adultos mayores.",
    body: `Las inscripciones para las clases de natación de invierno ya están abiertas en recepción.

Ofrecemos turnos para niños (a partir de 4 años), adolescentes, adultos y un programa especial de natación para adultos mayores con profesores especializados.

Recordá traer pileta, gorra y ojotas. Los días miércoles también funciona la clase de aquagym.`,
    author: "Profe Carolina",
    categorySlugs: ["natacion"],
  },
  {
    slug: "basquet-mini-sumate",
    title: "Básquet Mini: sumate a probar",
    summary:
      "El equipo de Básquet Mini busca chicos y chicas de 7 a 11 años. Entrenamientos martes y jueves a las 17 h.",
    body: `Estamos armando el plantel de Básquet Mini para la temporada que arranca. Buscamos chicos y chicas de 7 a 11 años que quieran sumarse a entrenar y jugar.

Los entrenamientos son los martes y jueves a las 17 h, en el gimnasio principal. La primera clase de prueba es sin cargo: vení con ropa cómoda y zapatillas adecuadas.

Esperamos tener un equipo competitivo para los torneos de la temporada y muchas ganas de divertirse.`,
    author: "Profe Diego",
    categorySlugs: ["basquet"],
  },
  {
    slug: "padel-clinica-fines-de-semana",
    title: "Pádel: clínica de fines de semana para mejorar el saque",
    summary:
      "Sábado 14 y domingo 15 de junio, clínica abierta de pádel con foco en saque y volea. Cupos limitados.",
    body: `La subcomisión de pádel organiza una clínica intensiva de fines de semana para socios y socias de todas las categorías.

Sábado 14: técnica de saque y ubicación en red (10 a 12 h).
Domingo 15: volea y definición (10 a 12 h).

Inscripción en recepción o por WhatsApp. Traé paleta y ropa cómoda.`,
    author: "Subcomisión de Pádel",
    categorySlugs: ["padel"],
  },
  {
    slug: "futbol-femenino-amistoso-fundacion",
    title: "Fútbol Femenino: amistoso solidario el domingo",
    summary:
      "El plantel femenino juega un amistoso a beneficio de la fundación del barrio. Entrada libre y colaboración voluntaria.",
    body: `El domingo a las 11 h el equipo de fútbol femenino del club enfrenta a un combinado invitado en un partido amistoso solidario.

La recaudación voluntaria se destina a la fundación vecina. Habrá merchandising del club y merienda para las chicas después del partido.

¡Sumate a alentar desde la tribuna!`,
    author: "Subcomisión de Fútbol Femenino",
    categorySlugs: ["futbol-femenino"],
  },
];

async function callApi(method, path, body) {
  const url = `${apiBase}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "x-admin-secret": adminSecret,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const errMsg = parsed && typeof parsed === "object" && "error" in parsed ? parsed.error : text;
    throw new Error(`${method} ${path} → ${res.status}: ${errMsg}`);
  }
  return parsed;
}

async function findNewsBySlugAdmin(slug) {
  const data = await callApi("GET", `/api/news/admin/list?limit=100`);
  if (!data || !Array.isArray(data.news)) return null;
  return data.news.find((n) => n.slug === slug) ?? null;
}

async function main() {
  console.log(`[seed-news] API: ${apiBase}`);
  console.log(`[seed-news] Reset: ${reset ? "sí (borra slugs previos)" : "no"}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const example of EXAMPLES) {
    try {
      const existing = await findNewsBySlugAdmin(example.slug);
      if (existing) {
        if (reset) {
          await callApi("DELETE", `/api/news/admin/${existing.id}`);
          console.log(`  ✗ borrado previo: ${example.slug}`);
        } else {
          console.log(`  - existe (skip): ${example.slug}`);
          skipped += 1;
          continue;
        }
      }

      const payload = {
        title: example.title,
        slug: example.slug,
        summary: example.summary,
        body: example.body,
        author: example.author,
        published: true,
        publishedAt: new Date().toISOString(),
        categorySlugs: example.categorySlugs,
      };

      const result = await callApi("POST", `/api/news/admin`, payload);
      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }
      console.log(`  ✓ creada: ${result.news.slug}`);
    } catch (err) {
      console.error(`  ! error en ${example.slug}:`, err.message ?? err);
    }
  }

  console.log(`\n[seed-news] Resumen: creadas=${created} actualizadas=${updated} omitidas=${skipped}`);
  console.log(`[seed-news] Listo. Visitá ${apiBase.replace(/\/api.*/, "")}/noticias para verlas en el sitio.`);
}

main().catch((err) => {
  console.error("[seed-news] error:", err);
  process.exit(1);
});
