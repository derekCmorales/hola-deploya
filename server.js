const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const PUERTO = Number(process.env.PORT ?? 8080);
const VERSION = process.env.DEPLOYA_VERSION ?? "local";
const CARPETA_PUBLICA = path.join(__dirname, "public");
const MARCADOR_VERSION = "{{VERSION}}";
const CACHE_PAGINA = "no-cache";
const CACHE_RECURSOS = "public, max-age=600";

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json",
};

const escaparHtml = (texto) =>
  texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Carga los archivos públicos una vez, ya comprimidos: el servidor solo sirve memoria. */
function cargarArchivos() {
  const archivos = new Map();
  for (const nombre of fs.readdirSync(CARPETA_PUBLICA)) {
    const tipo = TIPOS[path.extname(nombre)];
    if (!tipo) continue;
    let cuerpo = fs.readFileSync(path.join(CARPETA_PUBLICA, nombre));
    if (tipo.startsWith("text/html")) {
      cuerpo = Buffer.from(
        cuerpo.toString("utf8").replaceAll(MARCADOR_VERSION, escaparHtml(VERSION)),
      );
    }
    archivos.set(`/${nombre}`, {
      tipo,
      cuerpo,
      gzip: zlib.gzipSync(cuerpo, { level: 9 }),
      cache: tipo.startsWith("text/html") ? CACHE_PAGINA : CACHE_RECURSOS,
    });
  }
  archivos.set("/", archivos.get("/index.html"));
  return archivos;
}

const archivos = cargarArchivos();

http
  .createServer((req, res) => {
    const ruta = (req.url ?? "/").split("?")[0];
    if (ruta === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", version: VERSION }));
      return;
    }
    const archivo = archivos.get(ruta);
    if (!archivo || (req.method !== "GET" && req.method !== "HEAD")) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("No encontrado");
      return;
    }
    const conGzip = /\bgzip\b/.test(req.headers["accept-encoding"] ?? "");
    const cuerpo = conGzip ? archivo.gzip : archivo.cuerpo;
    res.writeHead(200, {
      "content-type": archivo.tipo,
      "content-length": cuerpo.length,
      "cache-control": archivo.cache,
      vary: "accept-encoding",
      ...(conGzip && { "content-encoding": "gzip" }),
    });
    res.end(req.method === "HEAD" ? undefined : cuerpo);
  })
  .listen(PUERTO, () => console.log(`hola-deploya escuchando en :${PUERTO}`));
