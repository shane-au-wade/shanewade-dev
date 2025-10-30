// this file is intended to be evaluated by the deno repl
// deno repl -A --eval-file scripts/repl-env.ts
import { Mistral } from "@mistralai/mistralai"
import { OpenAI } from "@openai/openai"
import { Anthropic } from "@anthropic-ai/sdk"
import { assert } from "@std/assert"
import { load } from "@std/dotenv"
import { z } from "@zod/zod"

const env = await load({
  envPath: ".env",
  export: true,
})

assert(env.MISTRAL_API_KEY, "MISTRAL_API_KEY is not set")
assert(env.OPENAI_API_KEY, "OPENAI_API_KEY is not set")
assert(env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY is not set")

const mistral = new Mistral({ apiKey: env.MISTRAL_API_KEY })
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

export { anthropic, env, mistral, openai, z }
