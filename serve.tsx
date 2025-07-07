import { serve } from "bun";
import index from "./src/index.html";
import { genViewerPrompt } from "prompt";
import prompt from "./other/prompt.html";
import { apply } from "apply";

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/": index,

    "/prompt.txt": async () => new Response(await genViewerPrompt(), {
      headers: {
        'Content-Type': "text/plain",
      },
    }),
    "/prompt": prompt,
    "/api/apply": {POST: async (req) => {
      const formData = await req.formData();
      const prompt = formData.get("prompt");
      const result = formData.get("result");
      try {
        if(typeof prompt !== "string" || typeof result !== "string") throw new Error("not strings");
        apply(prompt, result);
      }catch(e) {
        console.error(e);
        return new Response("error", {status: 400, headers: {'Content-Type': "text/plain"}});
      }
      return new Response("ok", {headers: {'Content-Type': "text/plain"}});
    }},
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
  port: 8389,
});

console.log(`🚀 Server running at ${server.url}`);
