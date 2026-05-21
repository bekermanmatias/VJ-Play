/**
 * Sube imágenes de prueba a las noticias creadas por seed-news-examples.mjs.
 *
 * Cada noticia recibe 2 imágenes (principal + galería) desde picsum.photos
 * (servicio público, siempre devuelve JPEG válido). La primera se marca como principal.
 *
 * Requisitos:
 *   - Backend corriendo (default http://localhost:4000) con ADMIN_SECRET en backend/.env.
 *   - Las noticias creadas con `npm run scripts:seed-news`.
 *
 * Uso:
 *   node scripts/seed-news-images.mjs                # sube solo a noticias sin imágenes
 *   node scripts/seed-news-images.mjs --replace      # borra imágenes existentes y sube de nuevo
 *   node scripts/seed-news-images.mjs --api http://localhost:4000
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
const replace = process.argv.includes("--replace");

if (!adminSecret) {
  console.error("[seed-news-images] Falta ADMIN_SECRET en backend/.env");
  process.exit(1);
}

// 2 imágenes por noticia: distinto seed → distinta foto (siempre 1600x1067 JPG).
const EXAMPLES = [
  {
    slug: "campeonato-padel-otono-2026",
    images: [
      { seed: "padel-cancha", alt: "Cancha de pádel iluminada de noche" },
      { seed: "padel-torneo", alt: "Trofeo y palas de pádel" },
    ],
  },
  {
    slug: "futbol-femenino-suma-categoria-sub-15",
    images: [
      { seed: "futbol-femenino-sub15", alt: "Equipo de fútbol femenino en entrenamiento" },
      { seed: "futbol-femenino-balon", alt: "Jugadora con la pelota" },
    ],
  },
  {
    slug: "obras-pintura-vestuarios-mayo-2026",
    images: [
      { seed: "club-vestuarios-pintura", alt: "Trabajos de pintura en vestuarios" },
      { seed: "club-instalaciones", alt: "Instalaciones del club" },
    ],
  },
  {
    slug: "torneo-interno-futbol-5-equipos",
    images: [
      { seed: "f5-cancha-iluminada", alt: "Cancha de Fútbol 5 con luz artificial" },
      { seed: "f5-equipo-formado", alt: "Equipo de F5 formado antes del partido" },
    ],
  },
  {
    slug: "natacion-clases-invierno",
    images: [
      { seed: "natacion-pileta-invierno", alt: "Pileta climatizada del club" },
      { seed: "natacion-andariveles", alt: "Andariveles de pileta" },
    ],
  },
  {
    slug: "basquet-mini-sumate",
    images: [
      { seed: "basquet-mini-aro", alt: "Aro de básquet en el gimnasio" },
      { seed: "basquet-mini-equipo", alt: "Chicos entrenando básquet" },
    ],
  },
];

function picsumUrl(seed) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1600/1067`;
}

async function api(method, path, body, headers) {
  const url = `${apiBase}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "x-admin-secret": adminSecret,
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
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
    const errMsg =
      parsed && typeof parsed === "object" && "error" in parsed ? parsed.error : text;
    throw new Error(`${method} ${path} → ${res.status}: ${errMsg}`);
  }
  return parsed;
}

async function findNewsBySlug(slug) {
  const data = await api("GET", `/api/news/admin/list?limit=100`);
  if (!data || !Array.isArray(data.news)) return null;
  return data.news.find((n) => n.slug === slug) ?? null;
}

async function downloadJpeg(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) {
    throw new Error(`Imagen vacía: ${url}`);
  }
  return buf;
}

async function uploadImage(newsId, filename, buffer, opts = {}) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: "image/jpeg" });
  form.append("image", blob, filename);
  if (opts.setAsMain) form.append("setAsMain", "true");
  if (opts.altText) form.append("altText", opts.altText);
  return api("POST", `/api/news/admin/${newsId}/images`, form);
}

async function clearImages(newsId, images) {
  for (const img of images) {
    try {
      await api("DELETE", `/api/news/admin/${newsId}/images/${img.id}`);
    } catch (err) {
      console.warn(`    ! no se pudo borrar imagen ${img.id}: ${err.message}`);
    }
  }
}

async function main() {
  console.log(`[seed-news-images] API: ${apiBase}`);
  console.log(`[seed-news-images] Replace: ${replace ? "sí (borra previas)" : "no"}`);

  let uploaded = 0;
  let skipped = 0;

  for (const example of EXAMPLES) {
    const news = await findNewsBySlug(example.slug);
    if (!news) {
      console.log(`  ! no existe la noticia ${example.slug} (corré seed-news primero)`);
      continue;
    }

    if (news.images.length > 0) {
      if (!replace) {
        console.log(`  - ya tiene imágenes (skip): ${example.slug}`);
        skipped += 1;
        continue;
      }
      console.log(`  ↺ borrando ${news.images.length} imágenes previas en ${example.slug}`);
      await clearImages(news.id, news.images);
    }

    for (let i = 0; i < example.images.length; i += 1) {
      const img = example.images[i];
      const url = picsumUrl(img.seed);
      try {
        process.stdout.write(`  · ${example.slug} [${i + 1}/${example.images.length}] descargando…`);
        const buffer = await downloadJpeg(url);
        process.stdout.write(` (${Math.round(buffer.length / 1024)} KB) subiendo…`);
        await uploadImage(news.id, `${img.seed}.jpg`, buffer, {
          setAsMain: i === 0,
          altText: img.alt,
        });
        console.log(` ✓`);
        uploaded += 1;
      } catch (err) {
        console.log(` ✗ ${err.message}`);
      }
    }
  }

  console.log(`\n[seed-news-images] Resumen: subidas=${uploaded} noticias_omitidas=${skipped}`);
}

main().catch((err) => {
  console.error("[seed-news-images] error:", err);
  process.exit(1);
});
