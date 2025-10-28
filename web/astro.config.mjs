// @ts-check
import { defineConfig } from "astro/config";
// import vercel from "@astrojs/vercel";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  site: "https://www.shanewade.dev",
  vite: {
    server: {
      fs: {
        allow: [
          // Allow serving files from the current working directory
          "../node_modules",
          "./public",
          "./src",
        ],
      },
    },
  },
  // adapter: vercel(),
  outDir: "../../dist",
});
