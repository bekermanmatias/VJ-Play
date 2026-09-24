// @ts-check
import { defineConfig, passthroughImageService } from "astro/config";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://varelajunior.com.ar",
  output: "server",
  security: {
    // Dominios confiables para la validación de Host/Origin de Astro.
    // Sin esto, Astro cae a un host "localhost" sin puerto y rechaza (403)
    // cualquier POST de formulario, incluido el login admin.
    // Debe incluir el dominio público y los hosts de desarrollo/preview.
    allowedDomains: [
      { hostname: "varelajunior.com.ar" },
      { hostname: "www.varelajunior.com.ar" },
      { hostname: "localhost" },
      { hostname: "127.0.0.1" },
    ],
  },
  adapter: node({
    mode: "standalone"
  }),
  image: {
    service: passthroughImageService(),
  },
  integrations: [react()],
  vite: {
    plugins: [
      tailwindcss(),
      {
        name: "vj-ignore-broken-sourcemap-sources",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith("/node_modules/src/")) {
              res.statusCode = 204;
              res.end();
              return;
            }
            next();
          });
        },
      },
    ],
  },
});
