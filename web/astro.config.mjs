// @ts-check
import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import deno from "@deno/astro-adapter"

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: deno(),
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
  outDir: "../dist",
})
