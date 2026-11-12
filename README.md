# hola-deploya

App de la demo de Deploya: un **rompe-bloques en pixel art**, pensado primero para móvil, con el design system de Deploya v4.1. Escucha en `PORT` (8080 por defecto), sirve el juego en `/` y responde `/health`.

## El juego

- **Cinco etapas = cinco niveles:** Recepción, Construcción, Ejecución, Enrutamiento y Operación. El riel del HUD avanza como en Deploya. Antes de cada etapa la bitácora escribe el comando de esa etapa.
- **Ganas** al terminar Operación: el cohete despega y la app queda **Saludable** en el dominio y la versión del despliegue (`DEPLOYA_VERSION`). **Pierdes** sin vidas: **Fallido · código 137**.
- **Bloques:** normal, doble capa (dos golpes), error (`bad`, vale 50), premio (`+` en Señal, siempre suelta un premio) y metal (no se rompe).
- **Premios:** C caché (paleta ancha), R réplica (dos bolas más), + rollback (una vida más), L lento (la bola frena).
- **Controles:** en móvil arrastras para mover la paleta y tocas para lanzar. En escritorio usas el mouse o ← → / A D; Espacio lanza, P o Esc pausa y Enter sigue.
- En el menú corre una **demo automática** de fondo.

## Cómo está hecho (ligero)

- Sin dependencias ni build: `server.js` (Node puro) carga `public/` en memoria al arrancar, ya comprimido con gzip. En total pesa unos 15 KB comprimidos.
- El lienzo lógico mide 180 px de ancho y se escala en múltiplos enteros con `image-rendering: pixelated`, así los pixeles se ven nítidos. El alto se adapta a la pantalla y el juego se pausa al cambiar de pestaña.
- **Design system:** los tokens OKLCH de `globals.css` (claro y oscuro) están copiados en `public/estilos.css`. El juego los lee y los convierte a RGB para pintar el lienzo, así que el tablero cambia con el tema. Usa la marca `deploya` con la «a» en Señal, Geist y Geist Mono, iconos Lucide, badges *Saludable* y *Fallido* con palabra e icono, el barrido de Señal en la etapa en curso y `prefers-reduced-motion`. La edición pixel solo escalona las esquinas en pasos de 2 px.
- El tema usa la misma clave que la app de Deploya (`deploya-tema`). El sonido sale de WebAudio con ondas cuadradas cortas y se puede silenciar.

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
docker build -t hola-deploya .
docker run --rm -p 8080:8080 hola-deploya
# abre http://localhost:8080 (en el celular: http://<ip-de-tu-máquina>:8080)
# otra terminal: curl localhost:8080/health → {"status":"ok","version":"local"}
```
