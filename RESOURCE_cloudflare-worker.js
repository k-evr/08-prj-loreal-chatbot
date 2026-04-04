// =============================================
//  RESOURCE_cloudflare-worker.js
//  Deploy this as your Cloudflare Worker.
//
//  Setup steps:
//  1. Go to https://dash.cloudflare.com → Workers & Pages → Create
//  2. Paste this entire file into the worker editor
//  3. Add your secret: Settings → Variables and Secrets
//     Name:  OPENAI_API_KEY
//     Value: sk-your-actual-key
//  4. Deploy — copy the *.workers.dev URL
//  5. Paste that URL into script.js as WORKER_URL
// =============================================

export default {
  async fetch(request, env) {

    // ── CORS preflight ──────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // ── Only allow POST ─────────────────────
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await request.json();

      // ── Forward to OpenAI ───────────────
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      const data = await openaiResponse.json();

      return new Response(JSON.stringify(data), {
        status: openaiResponse.status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      });
    }
  },
};

// ── CORS helper ─────────────────────────────
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}