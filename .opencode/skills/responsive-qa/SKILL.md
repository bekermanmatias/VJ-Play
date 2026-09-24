---
name: Responsive QA
description: Revisar visualmente y con Playwright páginas públicas, actividades y navegación de Varela Junior a cinco anchos concretos.
---

# Matriz de pruebas

Usar Playwright existente en `frontend/`: `npm run test:responsive` (instalar navegador con `npx playwright install chromium` si falta). Arrancar el dev server según `playwright.config.ts`. Inspeccionar 375, 768, 1024, 1440 y 1920px (alto ≥ 800px) en home, actividad deportiva, actividad de pileta, noticias, contacto y replays.

- Verificar overflow/clipping con dimensiones de elementos reales, sin confiar sólo en `overflow-x: hidden` de `html/body`.
- Navegación: móvil abierto/cerrado, scroll interno, grupos Deportes/Pileta, Tab y Escape, dropdown/submenu dentro del viewport desktop y no tapados.
- Títulos largos condensados: wrapping legible sin corte. Fotografía: `object-cover` donde corresponde, `object-contain` para logos, fallback si falla, hero LCP eager.
- Botones visibles y alcanzables, horarios/categorías sin desborde, formularios y Select accesibles, tarjetas noticias, contacto y Replays sin cambios de comportamiento.
- Registrar anchura/ruta del fallo y arreglar lo introducido; repetir en los cinco anchos. No reemplazar la identidad visual por cambios responsive.
