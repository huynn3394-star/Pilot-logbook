import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WeatherService } from "./lib/weather.js";
import { readATPLImage } from "./lib/atpl-media.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
  ".gz": "application/gzip",
};
export function createServer({ weather = new WeatherService() } = {}) {
  return http.createServer(async (req, res) => {
    const security = {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "geolocation=(), microphone=()",
      "X-Frame-Options": "DENY",
    };
    const send = (status, body, extra = {}) => {
      res.writeHead(status, { ...security, ...extra });
      res.end(body);
    };
    try {
      const url = new URL(req.url, "http://localhost");
      if (!["GET", "HEAD"].includes(req.method))
        return send(405, "Method not allowed");
      if (url.pathname === "/api/health")
        return send(
          200,
          JSON.stringify({
            ok: true,
            app: "avilog-preview",
            version: "0.1.0",
            storage: "browser-local",
          }),
          { "Content-Type": "application/json", "Cache-Control": "no-store" },
        );
      if (url.pathname === "/api/weather") {
        const data = await weather.get(
          (url.searchParams.get("station") || "").toUpperCase(),
        );
        return send(200, JSON.stringify(data), {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
      }
      if (url.pathname.startsWith("/atpl/media/")) {
        const filename = url.pathname.slice("/atpl/media/".length);
        const bytes = await readATPLImage(filename);
        if (!bytes) return send(404, "Not found");
        return send(200, req.method === "HEAD" ? null : bytes, {
          "Content-Type": types[path.extname(filename)],
          "Content-Length": bytes.length,
          "Cache-Control": "public, max-age=31536000, immutable",
        });
      }
      const mappings = [
        ["/vendor/pdfjs/", path.join(here, "node_modules/pdfjs-dist")],
        [
          "/vendor/tesseract/",
          path.join(here, "node_modules/tesseract.js/dist"),
        ],
        [
          "/vendor/tesseract-core/",
          path.join(here, "node_modules/tesseract.js-core"),
        ],
      ];
      let root = path.join(here, "public"),
        rel = decodeURIComponent(url.pathname).replace(/^\//, "");
      for (const [prefix, dir] of mappings)
        if (url.pathname.startsWith(prefix)) {
          root = dir;
          rel = decodeURIComponent(url.pathname.slice(prefix.length));
          break;
        }
      if (!rel) rel = "index.html";
      if (rel.endsWith("/")) rel += "index.html";
      if (
        rel.split("/").some((x) => x === ".." || x.startsWith(".")) ||
        rel.includes("\\") ||
        rel.includes("\0")
      )
        return send(404, "Not found");
      const file = path.resolve(root, rel);
      if (!file.startsWith(root + path.sep)) return send(404, "Not found");
      const data = await readFile(file);
      send(200, req.method === "HEAD" ? null : data, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control":
          rel === "sw.js" ? "no-cache" : "public, max-age=0, must-revalidate",
      });
    } catch (e) {
      const status =
        e.status || (e.code === "ENOENT" || e.code === "EISDIR" ? 404 : 500);
      send(
        status,
        JSON.stringify({ error: status === 500 ? "Server error" : e.message }),
        { "Content-Type": "application/json", "Cache-Control": "no-store" },
      );
    }
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, "0.0.0.0", () =>
    console.log(`AviLog listening at http://localhost:${port}`),
  );
}
