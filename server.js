const http = require("node:http");

const PUERTO = Number(process.env.PORT ?? 8080);
const VERSION = process.env.DEPLOYA_VERSION ?? "local";

const pagina = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>hola-deploya</title></head>
<body style="font-family: system-ui, sans-serif; margin: 64px">
  <h1>Hola desde Deploya</h1>
  <p>Versión ${VERSION}. Esta app corre en un contenedor con los límites de tu plan.</p>
</body>
</html>`;

http
  .createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", version: VERSION }));
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(pagina);
  })
  .listen(PUERTO, () => console.log(`hola-deploya escuchando en :${PUERTO}`));
