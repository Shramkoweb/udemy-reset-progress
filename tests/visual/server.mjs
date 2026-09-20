import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(process.argv[2] ?? ".output/chrome-mv3");
const PORT = Number(process.env.VISUAL_PORT ?? 4319);

// Playwright only runs globalSetup once this server answers, so the build cannot live there.
if (process.env.SKIP_BUILD !== "1") execFileSync("npx", ["wxt", "build"], { stdio: "inherit" });

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

createServer((req, res) => {
  const requested = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
  const file = join(ROOT, requested);

  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`);
});
