#!/usr/bin/env node
/** Tiny static server for the production build. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".otf": "font/otf",
  ".woff2": "font/woff2",
  ".bin": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

if (!fs.existsSync(DIST)) {
  console.error("dist/ is missing. Run: npm run build");
  process.exit(1);
}

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-cache" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  } catch {
    send(res, 400, "Bad request");
    return;
  }
  let file = path.join(DIST, pathname);
  if (!path.resolve(file).startsWith(path.resolve(DIST))) {
    send(res, 403, "Forbidden");
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) file = path.join(DIST, "index.html");
  if (!fs.existsSync(file)) {
    send(res, 404, "Not found");
    return;
  }
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": path.extname(file) === ".html" ? "no-cache" : "public, max-age=3600" });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log("KanjiDamage Atlas at http://" + HOST + ":" + PORT);
});
