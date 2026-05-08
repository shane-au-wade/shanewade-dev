// @ts-check
import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import vercel from "@astrojs/vercel"
import UnoCSS from "unocss/astro"

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: vercel(),
  integrations: [
    react(),
    UnoCSS({
      injectReset: true,
    }),
  ],
  site: "https://www.shanewade.dev",
  image: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
})
