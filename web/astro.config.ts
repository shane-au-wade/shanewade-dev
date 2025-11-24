import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import deno from "@deno/astro-adapter"
import UnoCSS from "unocss/astro"
import mdx from "@astrojs/mdx"

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: deno({
    start: true,
  }),
  outDir: "../dist",
  integrations: [
    react(),
    mdx(),
    UnoCSS(
      {
        // this will link to the @unocss/reset package
        injectReset: true,
      },
    ),
  ],
  site: "https://shanewade-dev.shane-au-wade.deno.net",
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
})
