---
name: UI Consistency Audit
description: Auditar coherencia visual, accesibilidad y duplicación de UI pública de Varela Junior sin rediseñar.
---

# Auditoría incremental

1. Comparar con páginas de referencia (home, `/deportes/futbol-infantil`, `/deportes/natacion-jubilados`, `/noticias`, `/replays`), nunca con estilos default de otra librería.
2. Buscar diferencias no justificadas de spacing/container, tamaños de letra y pesos, headings y eyebrow, colores hardcodeados, botones repetidos, borders, radios, sombras y breakpoints.
3. Detectar layouts casi idénticos, estilos y componentes duplicados; proponer consolidación mínima y mantener variantes sólo para diferencias reales.
4. Revisar semantic HTML, orden h1–h3, focus-visible, navegación Tab/Escape, aria-expanded/controls, labels, alt, estados disabled y contrastes.
5. Preservar rutas, SEO, textos, teléfonos, links, horarios, imagen y funcionamiento de Replays. Distinguir inconsistencias heredadas de regresiones introducidas; priorizar consolidación frente a rediseño.
6. Ejecutar `npm run check`, `npm run build` en `frontend/` y QA responsive. Entregar hallazgos con ruta y evidencia, no sólo una lista genérica.
