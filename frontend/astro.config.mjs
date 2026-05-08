// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://varelajunior.com.ar",
  output: "server",
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
