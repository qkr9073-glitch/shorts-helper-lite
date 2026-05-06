interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/hf/")) {
      const upstreamPath = url.pathname.slice("/hf".length);
      const upstreamUrl = `https://huggingface.co${upstreamPath}${url.search}`;

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
          },
        });
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405 });
      }

      const range = request.headers.get("Range");
      const upstreamRes = await fetch(upstreamUrl, {
        method: request.method,
        headers: {
          "User-Agent": "shorts-helper-lite-proxy",
          ...(range ? { Range: range } : {}),
        },
        redirect: "follow",
      });

      const headers = new Headers(upstreamRes.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Expose-Headers", "*");
      headers.delete("Content-Security-Policy");

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
