import { defineConfig, envField } from "astro/config"
import react from "@astrojs/react"
import deno from "@deno/astro-adapter"
import UnoCSS from "unocss/astro"
import process from "node:process"

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: deno({
    start: true,
  }),
  outDir: "../dist",
  integrations: [
    react(),
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
  env: {
    schema: {
      PUBLIC_SUPABASE_URL: envField.string({
        context: "client",
        access: "public",
        default: process.env.PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      }),
      PUBLIC_SUPABASE_ANON_KEY: envField.string({
        context: "client",
        access: "public",
        default: process.env.PUBLIC_SUPABASE_ANON_KEY ??
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
      }),
    },
  },
})
