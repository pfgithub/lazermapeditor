import { serve } from "bun";
import index from "./src/index.html";
import { genViewerPrompt } from "prompt";

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/": index,

    "/prompt.txt": async () => new Response(await genViewerPrompt(), {
      headers: {
        'Content-Type': "text/plain",
      },
    }),
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
