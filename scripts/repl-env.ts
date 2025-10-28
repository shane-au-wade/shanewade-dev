// this file is intended to be evaluated by the deno repl
// deno repl -A --eval-file scripts/repl-env.ts
import { Mistral } from "@mistralai/mistralai"
import { load } from "@std/dotenv"

const env = await load({
  envPath: ".env",
  export: true,
})

const apiKey = env.MISTRAL_API_KEY ?? ""
if (!apiKey) {
  throw new Error("MISTRAL_API_KEY is not set")
}

let mistral = new Mistral({ apiKey: env.MISTRAL_API_KEY })
