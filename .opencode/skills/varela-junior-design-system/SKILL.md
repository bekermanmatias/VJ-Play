---
name: Varela Junior Design System
description: Aplicar el lenguaje visual existente al crear o modificar UI pública, actividades, navegación y contenidos de Varela Junior.
---

# Identidad visual (la implementación actual es la fuente de verdad)

Preservar navy + verde + blanco, headings condensados, eyebrow verde uppercase, superficies rectas/minimalistas, fotografías grandes y espacio blanco. El tono es deportivo, editorial e institucional. No introducir estética genérica de shadcn, gradientes nuevos, pills, sombras fuertes ni cambiar las tipografías de marca. Los gradientes ya existentes del hero/noticias se conservan cuando son necesarios para leer sobre fotos.

## Foundations reales

- `frontend/src/styles/global.css`: `--color-vj-green: rgb(1 170 85)`, hover `--color-vj-green-600: rgb(1 150 75)`, variante `700: rgb(1 130 65)`, navy `--color-vj-dark: rgb(15 23 42)` (slate-900). Superficie blanca, slate-50 secundaria, texto slate-900/slate-600, bordes slate-200, focus verde (blanco sobre navy). Evitar nuevos hex arbitrarios.
- Fonts: Inter (`--font-sans`) cuerpo y Anton (`--font-display`) títulos. Importadas desde Google Fonts en `layouts/Layout.astro` y Storybook.
- Containers: max-width `80rem` (Tailwind `max-w-7xl`), px-4/6/8 a 375/768/1024. Sections: py-16/20; card gaps 6 (`1.5rem`); paneles de actividad px-6/10/14/16 y py-12/16. Spacing común: Tailwind `mt-2/3/4/8/10`, `gap-3/4/6`. No inventar un tamaño diferente por página.
- Bordes: 1px slate-200/700; esquinas cuadradas; sombras ligeras `shadow-sm` y `shadow-md` en tarjetas cuando ya se usan; `shadow-xl` existente para dropdowns y contacto. `focus-visible` global en CSS.
- Tipografía: `.vj-eyebrow` (12px bold, .22em, verde); `.vj-display-title` (Anton uppercase); `.vj-section-title` (36px black); `.vj-field-label` (12px bold); `.vj-field` (48px alto). Adaptar tamaño del título al contexto (actividad 5xl/6xl/7xl; sección 4xl/5xl). Metadata 11–12px y gris.

## Componentes y decisiones

- `ui/Button.astro`: variantes CVA `primary`, `outline`, `dark`; links navegan y botones actúan. `ui/Eyebrow.astro`, `ui/SectionHeader.astro`, `ui/ImageFallback.astro` (+ versión React para islas) son los cimientos.
- `activities/ActivityPage.astro` es el split navy/foto; slots `description`, `details`, `contact`. `ActivitySchedule` representa horarios simples o grupos, `ActivityContact` teléfonos/redes/CTA. `deportes/DeporteSplitLayout.astro` y `espacios/EspacioSplitLayout.astro` adaptan datos existentes sin alterar rutas ni contenido. Pileta también se sirve en `/deportes/[slug]`; no moverla a `/pileta`.
- `Navbar.astro` conserva dropdowns CSS y menú móvil nativo `<details>`; mejorar teclado y ARIA en esa implementación antes de considerar una primitiva nueva. `news/NewsCard.tsx` comparte tarjeta entre listado React y preview Astro; home featured/compact son estructuras distintas. `HomeSponsors` y `HomeContacto` conservan su composición.
- Imagen: `ImageFallback` deja el placeholder institucional y evita broken-image, con `loading="eager"` para primer hero/LCP y `lazy` para contenido secundario; nunca cambiar aspect ratio/object-cover sin motivo.
- Replays: preservar checkout y mensajes; inputs `.vj-field` y `.vj-field-label`, estados `disabled`, `aria-busy`, foco visible. Usar la librería existente lucide-react en islas React, SVG institucional en Astro.

ANTES de crear un componente nuevo: 1. buscar uno existente; 2. reutilizarlo si cumple el propósito; 3. crear una variant si cambia solamente la presentación; 4. crear componente nuevo si realmente cambia estructura/comportamiento. No abstraer un uso único.
