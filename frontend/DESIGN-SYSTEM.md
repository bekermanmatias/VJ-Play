# UI de Club Social Varela Junior

La implementación de producción es la referencia visual: Astro SSR + Tailwind CSS v4, Inter/Anton, navy (`slate-900`), verde institucional (`rgb(1 170 85)`) y blanco. No se migró el framework ni se cambió el contenido de las actividades.

## Inventario y decisiones

| Área | Implementación existente / consolidación |
|---|---|
| Home | `pages/index.astro` compone Hero, Ticker, Noticias, Sponsors y Contacto sin alterar el orden. |
| Header | `TopBar.astro` y `Navbar.astro`; dropdowns Deportes/Pileta desde `data/nav.ts`, mobile con `<details>` y panel fullscreen. ARIA, teclado y foco reforzados. |
| Actividades | `pages/deportes/[slug].astro` cubre Deportes y Pileta con `data/deportes.ts`. `ActivityPage` es el split reutilizable; `ActivitySchedule` y `ActivityContact` comparten estructura con Espacios (`pages/espacios/[slug].astro`). No se crearon rutas `/pileta/*` nuevas. |
| Noticias | `HomeNoticias.astro` mantiene featured/compact; `NewsCard.tsx` se comparte entre `DeporteNoticias.astro` y el listado dinámico `NewsLoadMoreList.tsx`. |
| Sponsors/Contacto | `HomeSponsors.astro` y `HomeContacto.astro` mantienen composición/ubicación y usan `SectionHeader` e `ImageFallback`. |
| Replays | `pages/replays.astro` y `ReplaysVerPartido.tsx` mantienen checkout y diseño; labels nativos y estilos `.vj-field` comunes. |

## Foundations y componentes

Tokens reales y escala en `src/styles/global.css`: verde `--color-vj-green`, navy `--color-vj-dark`, fondos blanco/slate-50, texto slate-900/slate-600, borde slate-200 y foco verde/blanco sobre navy; `--vj-container-width: 80rem`, espaciado de sección 4/5rem, gap de tarjetas 1.5rem. Fuentes `--font-sans: Inter`, `--font-display: Anton`. La estética usa bordes rectos y sombras ligeras existentes; no incorpora estilos shadcn.

- `components/ui/Button.astro` (CVA): primary, outline y dark, con `href` semántico o `<button>` y disabled. `Eyebrow`, `SectionHeader` e `ImageFallback` son los cimientos reutilizables.
- `components/activities/ActivityPage.astro` recibe slots de descripción, detalles y contacto; `ActivitySchedule` acepta items simples o grupos/subgrupos/entradas, `ActivityContact` soporta teléfonos y redes/CTA opcionales. `DeporteSplitLayout` y `EspacioSplitLayout` adaptan los modelos existentes.
- `ImageFallback.astro` / `ImageFallback.tsx`: placeholder institucional al fallar y lazy loading excepto primer hero/imagen de actividad.

No se agregaron Radix/shadcn: el header ya funciona con HTML/Astro y su sustitución exigiría hidratar y reestilizar sin ventaja visual. Lucide ya estaba instalado para React; se mantienen SVGs institucionales en Astro. No se abstrayeron TopBar, DesktopNavigation, FeaturedNews ni SponsorItem porque no había duplicación funcional útil.

## Catálogo y QA

`npm run storybook` abre el catálogo en el puerto 6006. Las stories muestran componentes de producción y casos de actividad real, botón, eyebrow, header de sección, horarios, contacto, tarjeta de noticias, fallback de imágenes y navbar. `npm run build-storybook` valida la generación estática y `npm run test:storybook` verifica stories en Chromium.

`npm run lint`, `npm run typecheck`, `npm run build` y `npm run test:responsive` validan implementación. La matriz Playwright visita home, fútbol infantil, natación jubilados, quincho, noticias, contacto y replays a 375/768/1024/1440/1920px, más 1280px para comprobar el cambio a navbar de escritorio; comprueba navegación, teclado, submenús, ausencia de errores de hidratación, fechas argentinas y fallback de imagen. La API del backend no se inicia con el dev server aislado; home y noticias muestran sus estados fallback durante esa prueba. Para ver contenido real en QA, usar el stack Docker (`cd deploy && docker compose up -d --build`).

Para probar Playwright contra Docker con backend accesible: `VJ_QA_BASE_URL=http://127.0.0.1 npm run test:responsive` (en PowerShell, definir `$env:VJ_QA_BASE_URL` antes del comando). En este modo Playwright no abre otro servidor Astro.

OpenCode descubre automáticamente las skills de `.opencode/skills/`; no es necesario añadir `opencode.json(c)` ni modificar permisos.
