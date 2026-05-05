# VJ Play (monorepo)

Repositorio del ecosistema **Varela Junior**: sitio oficial (replays y páginas del club) y API de video.

## Estructura

| Carpeta | Descripción |
|--------|-------------|
| [`frontend/`](frontend/) | Sitio Astro + React (Tailwind). |
| [`backend/`](backend/) | API Node.js + Express (FFmpeg, R2, Supabase). |

## Desarrollo

Instalá dependencias **solo** dentro de `frontend/` o `backend/`. No hace falta (ni conviene) ejecutar `npm install` en la raíz del repo: evita `node_modules` sueltos y carpetas `.astro`/`dist` fuera de lugar.

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

**Backend**

```bash
cd backend
cp .env.example .env   # o Copy-Item en Windows
npm install
npm run dev
```

Variables sensibles: usar `.env` en cada paquete (ver `.env.example` del backend). No commitear `.env`.

Si en la raíz del repo aparece una carpeta `node_modules` vieja y no se puede borrar, cerrá el servidor de desarrollo y Cursor/VS Code, o borrá esa carpeta desde el Explorador de archivos de Windows; el proyecto solo usa `frontend/node_modules` y `backend/node_modules`.
