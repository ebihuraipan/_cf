export default {
  async fetch(request) {
    return new Response("Hello World from Cloudflare Workers!\n", {
      headers: { "content-type": "text/plain" },
    });
  },
};
