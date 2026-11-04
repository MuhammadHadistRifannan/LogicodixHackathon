import { createServer as createHttpServer } from "node:http";
import { readFileSync } from "node:fs";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Versi diambil dari package.json agar peluncur bisa mendeteksi server lama yang masih berjalan.
const VERSION = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".fbx": "application/octet-stream",
  ".webmanifest": "application/manifest+json",
};

const PUBLIC_FILES = new Set(["/index.html", "/styles.css", "/manifest.webmanifest", "/sw.js"]);
const PUBLIC_DIRS = ["/client/", "/assets/"];

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function createGameServer() {
  const startedAt = Date.now();

  async function serveStatic(request, response) {
    const url = new URL(request.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    if (pathname === "/favicon.ico") pathname = "/assets/favicon.svg";

    const allowed = PUBLIC_FILES.has(pathname) || PUBLIC_DIRS.some((dir) => pathname.startsWith(dir));
    const filePath = path.resolve(ROOT, `.${pathname}`);
    if (!allowed || !isPathInside(ROOT, filePath)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("not a file");
      const headers = {
        "Content-Type": MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
      };

      // Video butuh HTTP Range agar browser bisa seek (mengulang dari awal).
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
      let start = 0;
      let end = info.size - 1;
      let status = 200;
      if (range && (range[1] || range[2])) {
        if (range[1]) {
          start = Number(range[1]);
          if (range[2]) end = Math.min(Number(range[2]), end);
        } else {
          start = Math.max(info.size - Number(range[2]), 0);
        }
        if (start > end || start >= info.size) {
          response.writeHead(416, { "Content-Range": `bytes */${info.size}` });
          response.end();
          return;
        }
        status = 206;
        headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
      }
      headers["Content-Length"] = end - start + 1;
      response.writeHead(status, headers);
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      createReadStream(filePath, { start, end }).on("error", () => response.destroy()).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  }

  const server = createHttpServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/healthz") {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(
        JSON.stringify({ ok: true, version: VERSION, uptime: Math.floor((Date.now() - startedAt) / 1000) }),
      );
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405);
      response.end("Method not allowed");
      return;
    }
    await serveStatic(request, response);
  });

  return {
    server,
    listen(port) {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, () => resolve(server.address()));
      });
    },
    close() {
      return new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
    },
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const app = createGameServer();
  const port = Number(process.env.PORT ?? 8787);
  app
    .listen(port)
    .then((address) => {
      const actualPort = typeof address === "object" && address ? address.port : port;
      console.log(`Logicodix server listening on http://0.0.0.0:${actualPort}`);
      console.log(`Health: http://127.0.0.1:${actualPort}/healthz`);
      for (const addresses of Object.values(networkInterfaces())) {
        for (const address of addresses ?? []) {
          if (address.family === "IPv4" && !address.internal) {
            console.log(`Android/HP di jaringan yang sama: buka http://${address.address}:${actualPort}`);
          }
        }
      }
    })
    .catch((error) => {
      console.error("Failed to start server", error);
      process.exitCode = 1;
    });

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
