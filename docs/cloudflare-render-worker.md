# SmartBookly render worker (headless screenshots)

Free Cloudflare Workers plan — Browser Rendering binding. Deploy this once,
then give me the Worker URL and I store it as `RENDER_WORKER_URL` together with
a shared secret `RENDER_WORKER_SECRET`.

## wrangler.toml

```toml
name = "smartbookly-render"
main = "src/index.js"
compatibility_date = "2024-11-01"

browser = { binding = "MYBROWSER" }
```

Set the secret:

```bash
wrangler secret put RENDER_WORKER_SECRET
```

## src/index.js

```js
import puppeteer from "@cloudflare/puppeteer";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (request.headers.get("X-Render-Secret") !== env.RENDER_WORKER_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { url, width = 1440, height = 1000, fullPage = true } = await request.json();
    if (!url || !/^https:\/\/[^/]*smartbookly|lovable\.app/.test(url)) {
      return new Response("Bad url", { status: 400 });
    }

    const browser = await puppeteer.launch(env.MYBROWSER);
    try {
      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 2 });
      await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
      await page.waitForSelector('html[data-render-ready="true"]', { timeout: 45000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1200));
      const png = await page.screenshot({ type: "png", fullPage });
      return new Response(png, { headers: { "Content-Type": "image/png" } });
    } catch (e) {
      return new Response(`Render failed: ${e.message}`, { status: 500 });
    } finally {
      await browser.close();
    }
  },
};
```

Deploy with `wrangler deploy`, then send me the `https://smartbookly-render.<subdomain>.workers.dev` URL.
