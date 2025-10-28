import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text(`Hello from Deno! ${Deno.version.deno}`);
});

Deno.serve(app.fetch);
