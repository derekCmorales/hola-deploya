# hola-deploya

App HTTP mínima para la demo de Deploya. Escucha en `PORT` (8080 por defecto) y responde en `/` y `/health`.

Se publica como repositorio **público** `derekCmorales/hola-deploya` con tres ramas, una por caso de la demo:

| Rama | Qué pasa en Deploya | Pantalla |
|---|---|---|
| `main` | `Dockerfile` propio → Saludable en `hola-deploya.localhost` | 12 → 12b |
| `roto` | `RUN npm run build` llama a `tsc`, que no está instalado → Fallido con código 127 | 12c |
| `sin-dockerfile` | Sin `Dockerfile`: la detección de stack reconoce Node (`package.json` con `start`) → Saludable con receta `node` (desde el Avance 2) | 11a, 12 |

## Publicarlo a mano en GitHub (una vez, unos 5 minutos)

1. En github.com → **New repository**: dueño `derekCmorales`, nombre `hola-deploya`, **Public**, sin README ni `.gitignore`.
2. **Rama `main`:** *Add file → Upload files* y sube `server.js`, `package.json`, `Dockerfile` y `README.md` de esta carpeta. Commit: `feat: app mínima con Dockerfile`.
3. **Rama `roto`:** en el selector de ramas escribe `roto` → *Create branch from main*. En esa rama sube y reemplaza `Dockerfile` y `package.json` con los de `variantes/roto/`. Commit: `test: build que falla con código 127`.
4. **Rama `sin-dockerfile`** (hace falta desde el Avance 2): crea la rama desde `main`, abre `Dockerfile` → *Delete file*. Commit: `test: sin Dockerfile para la detección de stack`.
5. Comprueba que el repo es público: abre `https://github.com/derekCmorales/hola-deploya` en una ventana privada.

URL que se pega en Deploya (pantalla 11a): `https://github.com/derekCmorales/hola-deploya`, rama `main` (o `roto` para mostrar el fallo).

## Probarlo sin Deploya

```bash
cd ejemplos/hola-deploya
docker build -t hola-deploya .
docker run --rm -p 8080:8080 hola-deploya
# otra terminal: curl localhost:8080/health → {"status":"ok","version":"local"}
```
