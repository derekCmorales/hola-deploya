"use strict";

/*
 * hola-deploya arcade: rompe-bloques en pixel art con el design system de Deploya.
 * Lienzo lógico de 180 px de ancho escalado en enteros (image-rendering: pixelated).
 * Las cinco etapas del riel son los niveles; terminar Operación deja la app Saludable.
 */
(() => {
  // ---------- Constantes ----------
  const ANCHO = 180;
  const ALTO_MIN = 260;
  const ALTO_MAX = 400;
  const COLUMNAS = 8;
  const LAD_ANCHO = 20;
  const LAD_ALTO = 8;
  const LAD_SEP = 2;
  const LAD_ARRIBA = 16;
  const MARGEN_X = (ANCHO - (COLUMNAS * LAD_ANCHO + (COLUMNAS - 1) * LAD_SEP)) / 2;
  const RADIO = 2;
  const PALETA_NORMAL = 32;
  const PALETA_ANCHA = 48;
  const PALETA_ALTO = 5;
  const PALETA_DESDE_ABAJO = 22;
  const PALETA_VEL_TECLADO = 210;
  const VEL_BASE = 120;
  const VEL_POR_NIVEL = 12;
  const VEL_POR_BLOQUE = 1.2;
  const VEL_EXTRA_MAX = 70;
  const ANGULO_MAX = Math.PI / 3;
  const ANGULO_LANZAMIENTO = 0.35;
  const VIDAS_INICIALES = 3;
  const VIDAS_MAX = 5;
  const BOLAS_MAX = 6;
  const PROB_PREMIO = 0.12;
  const VEL_PREMIO = 46;
  const DURACION_ANCHO = 12;
  const DURACION_LENTO = 8;
  const FACTOR_LENTO = 0.65;
  const DT_MAX = 1 / 30;
  const PASO_MAX_PX = 2;
  const ARRASTRE_TOQUE_PX = 3;
  const SENSIBILIDAD_TOQUE = 1.15;
  const ESTELA = 4;
  const VERSION = document.body.dataset.version || "local";

  const ETAPAS = [
    {
      nombre: "Recepción",
      comando: "git clone github.com/derekCmorales/hola-deploya",
      listo: "Repositorio recibido · rama main",
      mapa: ["........", "11111111", "11111111", "1p1111p1", "11111111"],
    },
    {
      nombre: "Construcción",
      comando: `docker build -t hola-deploya:${VERSION} .`,
      listo: "Imagen construida · 4 capas",
      mapa: ["...22...", "..2112..", ".211112.", "21p11p12", "11111111", "1.1..1.1"],
    },
    {
      nombre: "Ejecución",
      comando: "docker run --memory 512m --cpus 0.5 hola-deploya",
      listo: "Contenedor en marcha · :8080",
      mapa: ["22222222", "2x1111x2", "21p11p12", "21111112", "m111111m", "..2..2.."],
    },
    {
      nombre: "Enrutamiento",
      comando: `route ${location.host || "hola-deploya.localhost"} -> :8080`,
      listo: "Dominio publicado · HTTPS",
      mapa: ["2..22..2", ".1.11.1.", "..1pp1..", ".1.11.1.", "2.x11x.2", "11111111", "m......m"],
    },
    {
      nombre: "Operación",
      comando: "GET /health",
      listo: '200 {"status":"ok"}',
      mapa: ["x......x", ".2....2.", "1.2..2.1", "p1.22.1p", "11x11x11", "m2m22m2m", "11111111"],
    },
  ];

  /** Tipos de bloque: datos, no ramas. Para añadir uno basta con una entrada nueva. */
  const TIPOS = {
    1: { golpes: 1, puntos: 10, relleno: "card", borde: "border-stronger" },
    2: { golpes: 2, puntos: 25, relleno: "muted-foreground", borde: "foreground", herido: "faint" },
    x: { golpes: 1, puntos: 50, relleno: "bad", borde: "bad", bicho: true, sacude: true },
    p: { golpes: 1, puntos: 15, relleno: "signal-soft", borde: "signal", premioSeguro: true },
    m: { golpes: Infinity, puntos: 0, relleno: "sunken", borde: "border-stronger", metal: true },
  };

  const PREMIOS = {
    cache: { letra: "C", tono: "ok", aviso: "Caché: paleta ancha", aplicar: () => (efectos.ancho = DURACION_ANCHO) },
    replica: { letra: "R", tono: "signal", aviso: "Réplica: dos bolas más", aplicar: () => replicarBolas() },
    rollback: { letra: "+", tono: "warn", aviso: "Rollback: una vida más", aplicar: () => ganarVida() },
    lento: { letra: "L", tono: "muted-foreground", aviso: "Lento: la bola frena", aplicar: () => (efectos.lento = DURACION_LENTO) },
  };
  const LISTA_PREMIOS = Object.keys(PREMIOS);

  // ---------- Sprites (filas de caracteres; "." es vacío) ----------
  const GLIFOS = {
    0: ["xxx", "x.x", "x.x", "x.x", "xxx"],
    1: [".x.", "xx.", ".x.", ".x.", "xxx"],
    2: ["xxx", "..x", "xxx", "x..", "xxx"],
    3: ["xxx", "..x", "xxx", "..x", "xxx"],
    4: ["x.x", "x.x", "xxx", "..x", "..x"],
    5: ["xxx", "x..", "xxx", "..x", "xxx"],
    6: ["xxx", "x..", "xxx", "x.x", "xxx"],
    7: ["xxx", "..x", "..x", ".x.", ".x."],
    8: ["xxx", "x.x", "xxx", "x.x", "xxx"],
    9: ["xxx", "x.x", "xxx", "..x", "xxx"],
    "+": ["...", ".x.", "xxx", ".x.", "..."],
    C: ["xxx", "x..", "x..", "x..", "xxx"],
    R: ["xx.", "x.x", "xx.", "x.x", "x.x"],
    L: ["x..", "x..", "x..", "x..", "xxx"],
  };

  const BICHO = [
    [".x...x.", "..xxx..", "xx.x.xx", "..xxx..", ".x...x."],
    ["x.....x", "..xxx..", ".x.x.x.", "x.xxx.x", "......."],
  ];

  const COHETE = [
    "....x....",
    "...xxx...",
    "...xox...",
    "..xxxxx..",
    "..xxoxx..",
    "..xxxxx..",
    ".fxxxxxf.",
    "ff.xxx.ff",
    "f...x...f",
  ];
  const LLAMA = [
    ["...yzy...", "....y....", "........."],
    ["..yzzzy..", "...yzy...", "....y...."],
  ];
  const ESCALA_COHETE = 2;
  const COLORES_COHETE = { x: "foreground", o: "signal", f: "muted-foreground", y: "warn", z: "card" };

  // ---------- Utilidades ----------
  const $ = (s) => document.querySelector(s);
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  const signo = (v) => (v >= 0 ? 1 : -1);
  const azar = (a, b) => a + Math.random() * (b - a);

  const almacen = {
    leer(clave, defecto) {
      try {
        const v = localStorage.getItem(clave);
        return v === null ? defecto : v;
      } catch {
        return defecto;
      }
    },
    escribir(clave, valor) {
      try {
        localStorage.setItem(clave, valor);
      } catch {
        /* sin almacenamiento: el juego sigue */
      }
    },
  };

  /** OKLCH → rgb() para el lienzo; así no dependemos del soporte de oklch en canvas. */
  function aColorLienzo(texto) {
    const m = /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?))?\s*\)/.exec(texto);
    if (!m) return texto || "#000";
    const L = Number(m[1]) / (m[2] ? 100 : 1);
    const C = Number(m[3]);
    const h = (Number(m[4]) * Math.PI) / 180;
    const alfa = m[5] === undefined ? 1 : Number(m[5]) / (m[6] ? 100 : 1);
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lineal = [
      4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
    ];
    const [r, g, bb] = lineal.map((x) => {
      const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.abs(x) ** (1 / 2.4) - 0.055;
      return Math.round(limitar(v, 0, 1) * 255);
    });
    return `rgba(${r}, ${g}, ${bb}, ${alfa})`;
  }

  // ---------- Tema y paleta ----------
  const TOKENS = [
    "background", "sunken", "card", "foreground", "muted-foreground", "faint", "muted", "accent",
    "border", "border-strong", "border-stronger", "primary", "primary-foreground",
    "signal", "signal-soft", "signal-line", "ok", "warn", "bad", "dot",
  ];
  const color = {};
  let fondo = null;

  function leerPaleta() {
    const estilos = getComputedStyle(document.documentElement);
    for (const t of TOKENS) color[t] = aColorLienzo(estilos.getPropertyValue(`--${t}`).trim());
    $('meta[name="theme-color"]').setAttribute("content", color.background);
    fondo = null;
  }

  function temaActual() {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }

  function aplicarTema(tema, guardar = true) {
    document.documentElement.classList.toggle("dark", tema === "dark");
    if (guardar) almacen.escribir("deploya-tema", tema);
    const icono = document.querySelector('[data-accion="tema"] use');
    icono.setAttribute("href", tema === "dark" ? "#i-sol" : "#i-luna");
    leerPaleta();
  }

  // ---------- Sonido (WebAudio, ondas cuadradas cortas) ----------
  const sonido = {
    contexto: null,
    activo: almacen.leer("hola-deploya-sonido", "1") === "1",
    despertar() {
      if (this.contexto || !this.activo) return;
      const Contexto = window.AudioContext || window.webkitAudioContext;
      if (Contexto) this.contexto = new Contexto();
    },
    tono(frecuencia, duracion = 0.05, volumen = 0.035, forma = "square") {
      if (!this.activo || !this.contexto) return;
      const c = this.contexto;
      const osc = c.createOscillator();
      const gan = c.createGain();
      osc.type = forma;
      osc.frequency.value = frecuencia;
      gan.gain.setValueAtTime(volumen, c.currentTime);
      gan.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duracion);
      osc.connect(gan).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + duracion);
    },
    arpegio(notas, paso = 0.07) {
      notas.forEach((n, i) => setTimeout(() => this.tono(n, 0.09, 0.04), i * paso * 1000));
    },
  };

  const vibrar = (ms) => {
    if (navigator.vibrate) navigator.vibrate(ms);
  };

  // ---------- Estado ----------
  const lienzo = $("#juego");
  const ctx = lienzo.getContext("2d", { alpha: false });
  const escenario = $("#escenario");
  const reducido = matchMedia("(prefers-reduced-motion: reduce)");

  let alto = 320;
  let modo = "menu";
  let nivel = 0;
  let puntos = 0;
  let vidas = VIDAS_INICIALES;
  let mejor = Number(almacen.leer("hola-deploya-mejor", "0")) || 0;
  let velocidad = VEL_BASE;
  let tiempo = 0;
  let tiempoPartida = 0;
  let restantes = 0;
  let sacudida = 0;
  let victoria = false;
  let lanzarDemo = 0;

  const paleta = { x: ANCHO / 2, objetivo: ANCHO / 2, w: PALETA_NORMAL, y: 0, golpe: 0 };
  const efectos = { ancho: 0, lento: 0 };
  const teclas = new Set();
  const cohete = { y: 0, activo: false };
  let ladrillos = [];
  let bolas = [];
  let premios = [];
  let particulas = [];
  let textos = [];

  // ---------- Tamaño ----------
  function ajustarTamano() {
    const caja = escenario.getBoundingClientRect();
    if (!caja.width || !caja.height) return;
    // Escala entera cuando cabe (pixeles nítidos); el alto lógico se ajusta para llenar la pantalla.
    const escalaLibre = Math.min(caja.width / ANCHO, caja.height / ALTO_MIN);
    const escala = escalaLibre >= 2 ? Math.floor(escalaLibre) : escalaLibre;
    alto = Math.floor(limitar(caja.height / escala, ALTO_MIN, ALTO_MAX));
    lienzo.width = ANCHO;
    lienzo.height = alto;
    lienzo.style.width = `${Math.floor(ANCHO * escala)}px`;
    lienzo.style.height = `${Math.floor(alto * escala)}px`;
    paleta.y = alto - PALETA_DESDE_ABAJO;
    for (const b of bolas) b.y = Math.min(b.y, alto);
    ctx.imageSmoothingEnabled = false;
    fondo = null;
  }

  function prepararFondo() {
    fondo = document.createElement("canvas");
    fondo.width = ANCHO;
    fondo.height = alto;
    const f = fondo.getContext("2d");
    f.fillStyle = color.background;
    f.fillRect(0, 0, ANCHO, alto);
    f.fillStyle = color.dot;
    for (let y = 4; y < alto; y += 8) for (let x = 4; x < ANCHO; x += 8) f.fillRect(x, y, 1, 1);
  }

  // ---------- Niveles ----------
  function cargarNivel(indice) {
    ladrillos = [];
    restantes = 0;
    ETAPAS[indice].mapa.forEach((fila, r) => {
      [...fila].forEach((c, k) => {
        const tipo = TIPOS[c];
        if (!tipo) return;
        ladrillos.push({
          x: MARGEN_X + k * (LAD_ANCHO + LAD_SEP),
          y: LAD_ARRIBA + r * (LAD_ALTO + LAD_SEP),
          tipo: c,
          golpes: tipo.golpes,
          vivo: true,
          brillo: 0,
          entrada: reducido.matches ? 0 : 0.25 + r * 0.06 + k * 0.025,
        });
        if (!tipo.metal) restantes++;
      });
    });
    premios = [];
    efectos.ancho = 0;
    efectos.lento = 0;
    velocidad = VEL_BASE + indice * VEL_POR_NIVEL;
    nuevaBola();
  }

  function nuevaBola() {
    bolas = [{ x: paleta.x, y: paleta.y - RADIO, vx: 0, vy: 0, pegada: true, estela: [] }];
    lanzarDemo = 0.8;
  }

  function lanzar() {
    let lanzo = false;
    for (const b of bolas) {
      if (!b.pegada) continue;
      const angulo = azar(-ANGULO_LANZAMIENTO, ANGULO_LANZAMIENTO);
      b.vx = velocidad * Math.sin(angulo);
      b.vy = -velocidad * Math.cos(angulo);
      b.pegada = false;
      lanzo = true;
    }
    if (lanzo) sonido.tono(520, 0.06);
  }

  function replicarBolas() {
    lanzar();
    const nuevas = [];
    for (const b of bolas) {
      for (const giro of [-0.45, 0.45]) {
        if (bolas.length + nuevas.length >= BOLAS_MAX) break;
        const cos = Math.cos(giro);
        const sin = Math.sin(giro);
        nuevas.push({ x: b.x, y: b.y, vx: b.vx * cos - b.vy * sin, vy: b.vx * sin + b.vy * cos, pegada: false, estela: [] });
      }
    }
    bolas.push(...nuevas);
  }

  function ganarVida() {
    vidas = Math.min(VIDAS_MAX, vidas + 1);
    pintarHud();
  }

  // ---------- Simulación ----------
  function actualizar(dt) {
    tiempo += dt;
    actualizarParticulas(dt);
    if (sacudida > 0) sacudida = Math.max(0, sacudida - dt);
    if (modo === "menu") {
      moverPaletaDemo(dt);
      simular(dt, true);
    } else if (modo === "jugando") {
      tiempoPartida += dt;
      moverPaletaJugador(dt);
      simular(dt, false);
    } else if (modo === "fin" && cohete.activo) {
      cohete.y -= dt * 90;
      if (!reducido.matches && Math.random() < 0.6) {
        chispas(ANCHO / 2, cohete.y + COHETE.length * ESCALA_COHETE + 4, 1, ["warn", "faint"], 30);
      }
    }
  }

  function moverPaletaJugador(dt) {
    const direccion = (teclas.has("derecha") ? 1 : 0) - (teclas.has("izquierda") ? 1 : 0);
    if (direccion) paleta.objetivo += direccion * PALETA_VEL_TECLADO * dt;
    moverPaleta(dt);
  }

  function moverPaletaDemo(dt) {
    const bola = bolas.reduce((baja, b) => (!baja || (b.vy > 0 && b.y > baja.y) ? b : baja), null);
    if (bola) paleta.objetivo = bola.x + Math.sin(tiempo * 1.7) * (paleta.w * 0.3);
    lanzarDemo -= dt;
    if (lanzarDemo <= 0 && bolas.some((b) => b.pegada)) lanzar();
    moverPaleta(dt);
  }

  function moverPaleta(dt) {
    const anchoObjetivo = efectos.ancho > 0 ? PALETA_ANCHA : PALETA_NORMAL;
    paleta.w += (anchoObjetivo - paleta.w) * Math.min(1, dt * 10);
    const mitad = paleta.w / 2;
    paleta.objetivo = limitar(paleta.objetivo, mitad, ANCHO - mitad);
    paleta.x += (paleta.objetivo - paleta.x) * Math.min(1, dt * 30);
    paleta.x = limitar(paleta.x, mitad, ANCHO - mitad);
    paleta.golpe = Math.max(0, paleta.golpe - dt);
  }

  function simular(dt, demo) {
    efectos.ancho = Math.max(0, efectos.ancho - dt);
    efectos.lento = Math.max(0, efectos.lento - dt);
    for (const l of ladrillos) {
      l.entrada = Math.max(0, l.entrada - dt);
      l.brillo = Math.max(0, l.brillo - dt);
    }
    const factor = efectos.lento > 0 ? FACTOR_LENTO : 1;
    for (const b of bolas) {
      if (b.pegada) {
        b.x = paleta.x;
        b.y = paleta.y - RADIO;
        continue;
      }
      b.estela.unshift({ x: b.x, y: b.y });
      if (b.estela.length > ESTELA) b.estela.pop();
      moverBola(b, dt * factor, demo);
    }
    const antes = bolas.length;
    bolas = bolas.filter((b) => !b.perdida);
    if (antes && !bolas.length) perderBola(demo);
    actualizarPremios(dt);
    if (restantes === 0 && modo !== "transicion") etapaCompleta(demo);
    if (!demo) pintarEfectos();
  }

  function moverBola(b, dt, demo) {
    const pasos = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / PASO_MAX_PX));
    const paso = dt / pasos;
    for (let i = 0; i < pasos; i++) {
      b.x += b.vx * paso;
      b.y += b.vy * paso;
      if (b.x < RADIO) {
        b.x = RADIO;
        b.vx = Math.abs(b.vx);
        sonido.tono(300, 0.03);
      } else if (b.x > ANCHO - RADIO) {
        b.x = ANCHO - RADIO;
        b.vx = -Math.abs(b.vx);
        sonido.tono(300, 0.03);
      }
      if (b.y < RADIO) {
        b.y = RADIO;
        b.vy = Math.abs(b.vy);
        sonido.tono(300, 0.03);
      }
      if (chocarPaleta(b) || chocarLadrillo(b, demo)) continue;
      if (b.y - RADIO > alto) {
        b.perdida = true;
        return;
      }
    }
  }

  function chocarPaleta(b) {
    if (b.vy <= 0) return false;
    const mitad = paleta.w / 2;
    if (b.y + RADIO < paleta.y || b.y - RADIO > paleta.y + PALETA_ALTO) return false;
    if (b.x + RADIO < paleta.x - mitad || b.x - RADIO > paleta.x + mitad) return false;
    const relativo = limitar((b.x - paleta.x) / mitad, -1, 1);
    const angulo = relativo * ANGULO_MAX + azar(-0.03, 0.03);
    const v = Math.hypot(b.vx, b.vy);
    b.vx = v * Math.sin(angulo);
    b.vy = -v * Math.cos(angulo);
    b.y = paleta.y - RADIO;
    paleta.golpe = 0.12;
    sonido.tono(220, 0.05);
    return true;
  }

  function chocarLadrillo(b, demo) {
    for (const l of ladrillos) {
      if (!l.vivo || l.entrada > 0) continue;
      const dx = b.x - (l.x + LAD_ANCHO / 2);
      const dy = b.y - (l.y + LAD_ALTO / 2);
      const solapeX = LAD_ANCHO / 2 + RADIO - Math.abs(dx);
      const solapeY = LAD_ALTO / 2 + RADIO - Math.abs(dy);
      if (solapeX <= 0 || solapeY <= 0) continue;
      if (solapeX < solapeY) {
        b.x += signo(dx) * solapeX;
        b.vx = signo(dx) * Math.abs(b.vx);
      } else {
        b.y += signo(dy) * solapeY;
        b.vy = signo(dy) * Math.abs(b.vy);
      }
      golpear(l, demo);
      return true;
    }
    return false;
  }

  function golpear(l, demo) {
    const tipo = TIPOS[l.tipo];
    l.brillo = 0.08;
    if (tipo.metal) {
      sonido.tono(880, 0.03, 0.02);
      return;
    }
    l.golpes--;
    const cx = l.x + LAD_ANCHO / 2;
    const cy = l.y + LAD_ALTO / 2;
    if (l.golpes > 0) {
      sonido.tono(440, 0.04);
      chispas(cx, cy, 4, [tipo.borde]);
      return;
    }
    l.vivo = false;
    restantes--;
    chispas(cx, cy, reducido.matches ? 4 : 14, [tipo.relleno, tipo.borde]);
    sonido.tono(tipo.bicho ? 160 : 660 + Math.random() * 120, tipo.bicho ? 0.12 : 0.05);
    if (tipo.sacude && !reducido.matches) sacudida = 0.18;
    if (demo) return;
    puntos += tipo.puntos;
    textos.push({ x: cx, y: l.y, texto: `+${tipo.puntos}`, vida: 0.7 });
    acelerar();
    if (tipo.premioSeguro || Math.random() < PROB_PREMIO) soltarPremio(cx, cy);
    if (tipo.bicho) vibrar(12);
    pintarHud();
  }

  function acelerar() {
    const tope = VEL_BASE + nivel * VEL_POR_NIVEL + VEL_EXTRA_MAX;
    const nueva = Math.min(tope, velocidad + VEL_POR_BLOQUE);
    const factor = nueva / velocidad;
    velocidad = nueva;
    for (const b of bolas) {
      b.vx *= factor;
      b.vy *= factor;
    }
  }

  function soltarPremio(x, y) {
    const clave = LISTA_PREMIOS[Math.floor(Math.random() * LISTA_PREMIOS.length)];
    premios.push({ x, y, clave });
  }

  function actualizarPremios(dt) {
    const mitad = paleta.w / 2;
    for (const p of premios) {
      p.y += VEL_PREMIO * dt;
      const atrapado = p.y + 3 >= paleta.y && p.y - 3 <= paleta.y + PALETA_ALTO && Math.abs(p.x - paleta.x) <= mitad + 5;
      if (atrapado) {
        p.fuera = true;
        const premio = PREMIOS[p.clave];
        premio.aplicar();
        avisar(premio.aviso, premio.tono);
        sonido.arpegio([660, 880, 1100]);
        chispas(p.x, paleta.y, 8, [premio.tono]);
      } else if (p.y > alto + 8) {
        p.fuera = true;
      }
    }
    premios = premios.filter((p) => !p.fuera);
  }

  function perderBola(demo) {
    if (demo) {
      nuevaBola();
      return;
    }
    vidas--;
    efectos.ancho = 0;
    efectos.lento = 0;
    premios = [];
    if (!reducido.matches) sacudida = 0.3;
    vibrar(40);
    sonido.arpegio([330, 220, 140], 0.09);
    pintarHud();
    if (vidas <= 0) terminar(false);
    else nuevaBola();
  }

  function etapaCompleta(demo) {
    if (demo) {
      cargarNivel(0);
      return;
    }
    bolas = [];
    sonido.arpegio([523, 659, 784, 1047]);
    if (nivel === ETAPAS.length - 1) terminar(true);
    else mostrarEtapa(nivel + 1);
  }

  // ---------- Partículas y textos ----------
  function chispas(x, y, cantidad, tonos, fuerza = 60) {
    for (let i = 0; i < cantidad; i++) {
      particulas.push({
        x,
        y,
        vx: azar(-fuerza, fuerza),
        vy: azar(-fuerza, fuerza * 0.4),
        vida: azar(0.3, 0.6),
        tono: tonos[i % tonos.length],
        tam: Math.random() < 0.3 ? 2 : 1,
      });
    }
  }

  function actualizarParticulas(dt) {
    for (const p of particulas) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
      p.vida -= dt;
    }
    particulas = particulas.filter((p) => p.vida > 0);
    for (const t of textos) {
      t.y -= 18 * dt;
      t.vida -= dt;
    }
    textos = textos.filter((t) => t.vida > 0);
  }

  // ---------- Dibujo ----------
  function pintarSprite(filas, x, y, colores, escala = 1) {
    for (let r = 0; r < filas.length; r++) {
      const fila = filas[r];
      for (let c = 0; c < fila.length; c++) {
        const clave = fila[c];
        if (clave === ".") continue;
        ctx.fillStyle = color[colores[clave] ?? colores.x];
        ctx.fillRect(x + c * escala, y + r * escala, escala, escala);
      }
    }
  }

  function pintarTexto(texto, x, y, tono) {
    const anchoTotal = texto.length * 4 - 1;
    let cursor = Math.round(x - anchoTotal / 2);
    for (const ch of texto) {
      const glifo = GLIFOS[ch];
      if (glifo) pintarSprite(glifo, cursor, Math.round(y), { x: tono });
      cursor += 4;
    }
  }

  /** Rectángulo con esquinas recortadas: el bloque básico del estilo pixel. */
  function bloque(x, y, w, h, relleno, borde) {
    ctx.fillStyle = color[borde];
    ctx.fillRect(x + 1, y, w - 2, h);
    ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = color[relleno];
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  }

  function dibujarLadrillo(l) {
    const tipo = TIPOS[l.tipo];
    const caida = Math.ceil(l.entrada * 8) * 6;
    const x = l.x;
    const y = l.y - caida;
    if (caida > alto) return;
    const relleno = l.golpes < tipo.golpes && tipo.herido ? tipo.herido : tipo.relleno;
    bloque(x, y, LAD_ANCHO, LAD_ALTO, l.brillo > 0 || tipo.premioSeguro ? "card" : relleno, tipo.borde);
    if (tipo.premioSeguro) {
      ctx.fillStyle = color[relleno];
      ctx.fillRect(x + 1, y + 1, LAD_ANCHO - 2, LAD_ALTO - 2);
    }
    ctx.fillStyle = color["primary-foreground"];
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x + 2, y + 1, LAD_ANCHO - 4, 1);
    ctx.globalAlpha = 1;
    if (tipo.bicho) {
      const cuadro = BICHO[Math.floor(tiempo * 4) % BICHO.length];
      pintarSprite(cuadro, x + 7, y + 2, { x: "background" });
    } else if (tipo.premioSeguro) {
      const parpadeo = Math.floor(tiempo * 3) % 2 === 0;
      pintarSprite(GLIFOS["+"], x + 9, y + 2, { x: parpadeo ? "signal" : "signal-line" });
    } else if (tipo.metal) {
      ctx.fillStyle = color["border-stronger"];
      ctx.fillRect(x + 3, y + 3, 2, 2);
      ctx.fillRect(x + LAD_ANCHO - 5, y + 3, 2, 2);
    } else if (l.golpes < tipo.golpes) {
      ctx.fillStyle = color.foreground;
      ctx.fillRect(x + 8, y + 2, 1, 2);
      ctx.fillRect(x + 9, y + 4, 1, 1);
      ctx.fillRect(x + 10, y + 5, 2, 1);
    }
  }

  function dibujarPremio(p) {
    const premio = PREMIOS[p.clave];
    const x = Math.round(p.x - 6);
    const y = Math.round(p.y - 4);
    const parpadeo = Math.floor(tiempo * 6) % 2 === 0;
    bloque(x, y, 13, 9, parpadeo ? "card" : "sunken", premio.tono);
    pintarSprite(GLIFOS[premio.letra], x + 5, y + 2, { x: premio.tono });
  }

  function dibujarPaleta() {
    const w = Math.round(paleta.w);
    const x = Math.round(paleta.x - w / 2);
    const aplasta = paleta.golpe > 0 ? 1 : 0;
    const y = paleta.y + aplasta;
    const borde = efectos.ancho > 0 ? "ok" : "primary";
    bloque(x, y, w, PALETA_ALTO - aplasta, "primary", borde);
    if (efectos.ancho > 0) {
      ctx.fillStyle = color.ok;
      ctx.fillRect(x + 1, y + 1, 2, PALETA_ALTO - 2 - aplasta);
      ctx.fillRect(x + w - 3, y + 1, 2, PALETA_ALTO - 2 - aplasta);
    }
    const luz = x + 2 + (Math.floor(tiempo * 24) % Math.max(1, w - 4));
    ctx.fillStyle = color.signal;
    ctx.fillRect(luz, y + 1, 2, 1);
  }

  function dibujarBola(b) {
    ctx.fillStyle = color["signal-line"];
    b.estela.forEach((punto, i) => {
      if (i % 2 === 0) ctx.fillRect(Math.round(punto.x) - 1, Math.round(punto.y) - 1, 2, 2);
    });
    const x = Math.round(b.x) - RADIO;
    const y = Math.round(b.y) - RADIO;
    ctx.fillStyle = color.signal;
    ctx.fillRect(x + 1, y, 2, 4);
    ctx.fillRect(x, y + 1, 4, 2);
  }

  function dibujarCohete() {
    const x = Math.round(ANCHO / 2 - (COHETE[0].length * ESCALA_COHETE) / 2);
    const y = Math.round(cohete.y);
    const flota = reducido.matches ? 0 : Math.floor(tiempo * 4) % 2;
    const llama = LLAMA[Math.floor(tiempo * 12) % LLAMA.length];
    pintarSprite(COHETE, x, y - flota, COLORES_COHETE, ESCALA_COHETE);
    pintarSprite(llama, x, y + COHETE.length * ESCALA_COHETE - flota, COLORES_COHETE, ESCALA_COHETE);
  }

  function dibujar() {
    if (!fondo) prepararFondo();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fondo, 0, 0);
    if (sacudida > 0) {
      ctx.translate(Math.round(azar(-2, 2)), Math.round(azar(-2, 2)));
    }
    for (const l of ladrillos) if (l.vivo) dibujarLadrillo(l);
    for (const p of premios) dibujarPremio(p);
    if (!cohete.activo) dibujarPaleta();
    for (const b of bolas) dibujarBola(b);
    for (const p of particulas) {
      ctx.fillStyle = color[p.tono] ?? color.foreground;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam);
    }
    for (const t of textos) pintarTexto(t.texto, t.x, t.y, "foreground");
    if (cohete.activo) dibujarCohete();
  }

  // ---------- HUD y capas (DOM, solo cuando algo cambia) ----------
  const hud = {
    puntos: $("#puntos"),
    vidas: $("#vidas"),
    etapa: $("#etapa"),
    efectos: $("#efectos"),
    riel: [...document.querySelectorAll("#riel i")],
    pausa: $("#btn-pausa"),
    pista: $("#pista"),
    aviso: $("#aviso"),
  };
  let ultimoEfecto = "";
  let temporizadorAviso = 0;

  function pintarHud() {
    hud.puntos.textContent = String(puntos);
    hud.vidas.innerHTML = "";
    for (let i = 0; i < Math.max(VIDAS_INICIALES, vidas); i++) {
      const v = document.createElement("i");
      if (i >= vidas) v.className = "perdida";
      hud.vidas.append(v);
    }
    hud.vidas.setAttribute("aria-label", `${vidas} ${vidas === 1 ? "vida" : "vidas"}`);
  }

  function pintarRiel(actual, fallo = false) {
    hud.riel.forEach((tramo, i) => {
      tramo.className = i < actual ? "hecho" : i === actual ? (fallo ? "fallido" : "actual") : "";
    });
  }

  function pintarEfectos() {
    const partes = [];
    if (efectos.ancho > 0) partes.push(`caché ${Math.ceil(efectos.ancho)} s`);
    if (efectos.lento > 0) partes.push(`lento ${Math.ceil(efectos.lento)} s`);
    const texto = partes.join(" · ");
    if (texto !== ultimoEfecto) hud.efectos.textContent = ultimoEfecto = texto;
    const pegada = modo === "jugando" && bolas.some((b) => b.pegada);
    if (hud.pista.hidden === pegada) hud.pista.hidden = !pegada;
  }

  function avisar(texto, tono) {
    hud.aviso.textContent = texto;
    hud.aviso.className = `aviso px mono tono-${tono === "muted-foreground" ? "muted" : tono}`;
    hud.aviso.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => (hud.aviso.hidden = true), 1600);
  }

  const capas = {
    menu: $("#capa-menu"),
    ayuda: $("#capa-ayuda"),
    etapa: $("#capa-etapa"),
    pausa: $("#capa-pausa"),
    fin: $("#capa-fin"),
  };

  function mostrarCapa(nombre) {
    for (const [clave, capa] of Object.entries(capas)) capa.classList.toggle("activa", clave === nombre);
    hud.pista.hidden = true;
    const capa = capas[nombre];
    if (!capa) return;
    for (const p of capa.querySelectorAll(".px-entrada")) {
      p.style.animation = "none";
      void p.offsetWidth;
      p.style.animation = "";
    }
    if (matchMedia("(pointer: fine)").matches) capa.querySelector(".btn.primario")?.focus();
  }

  // ---------- Flujo de partida ----------
  let escritura = 0;

  function irAlMenu() {
    modo = "menu";
    victoria = false;
    cohete.activo = false;
    hud.pausa.disabled = true;
    hud.etapa.textContent = "Listo para desplegar";
    hud.efectos.textContent = ultimoEfecto = "";
    pintarRiel(-1);
    $("#mejor").textContent = String(mejor);
    cargarNivel(0);
    mostrarCapa("menu");
  }

  function jugar() {
    sonido.despertar();
    puntos = 0;
    vidas = VIDAS_INICIALES;
    tiempoPartida = 0;
    victoria = false;
    cohete.activo = false;
    particulas = [];
    pintarHud();
    mostrarEtapa(0);
  }

  function mostrarEtapa(indice) {
    modo = "transicion";
    nivel = indice;
    hud.pausa.disabled = true;
    const etapa = ETAPAS[indice];
    pintarRiel(indice);
    hud.etapa.textContent = `Etapa ${indice + 1}/${ETAPAS.length} · ${etapa.nombre}`;
    $("#etapa-num").textContent = `Etapa ${indice + 1} de ${ETAPAS.length}`;
    $("#titulo-etapa").textContent = etapa.nombre;
    escribirComando(`$ ${etapa.comando}`, etapa.listo);
    ladrillos = [];
    bolas = [];
    premios = [];
    mostrarCapa("etapa");
  }

  function escribirComando(comando, listo) {
    const destino = $("#comando");
    const ok = $("#comando-ok");
    clearInterval(escritura);
    ok.textContent = "";
    if (reducido.matches) {
      destino.textContent = comando;
      ok.textContent = listo;
      return;
    }
    let i = 0;
    destino.textContent = "";
    escritura = setInterval(() => {
      i++;
      destino.textContent = comando.slice(0, i);
      if (i % 3 === 0) sonido.tono(1200, 0.01, 0.012);
      if (i >= comando.length) {
        clearInterval(escritura);
        ok.textContent = listo;
      }
    }, 22);
  }

  function seguir() {
    if (modo !== "transicion") return;
    clearInterval(escritura);
    cargarNivel(nivel);
    modo = "jugando";
    hud.pausa.disabled = false;
    mostrarCapa(null);
    pintarEfectos();
  }

  function pausar() {
    if (modo !== "jugando") return;
    modo = "pausa";
    teclas.clear();
    mostrarCapa("pausa");
  }

  function reanudar() {
    if (modo !== "pausa") return;
    modo = "jugando";
    mostrarCapa(null);
    pintarEfectos();
  }

  function terminar(gano) {
    modo = "fin";
    victoria = gano;
    hud.pausa.disabled = true;
    bolas = [];
    premios = [];
    if (puntos > mejor) {
      mejor = puntos;
      almacen.escribir("hola-deploya-mejor", String(mejor));
    }
    const estado = $("#fin-estado");
    if (gano) {
      pintarRiel(ETAPAS.length);
      cohete.activo = true;
      cohete.y = paleta.y - COHETE.length * ESCALA_COHETE;
      estado.className = "badge ok";
      estado.innerHTML = '<svg><use href="#i-check"/></svg>Saludable';
      $("#titulo-fin").textContent = "Tu app está en línea";
      $("#fin-texto").textContent = `hola-deploya responde en ${location.host || "hola-deploya.localhost"} · versión ${VERSION}.`;
      $("#fin-boton").textContent = "Desplegar otra vez";
      hud.etapa.textContent = "Saludable";
      sonido.arpegio([523, 659, 784, 1047, 1319], 0.09);
    } else {
      pintarRiel(nivel, true);
      estado.className = "badge bad";
      estado.innerHTML = '<svg><use href="#i-x"/></svg>Fallido';
      $("#titulo-fin").textContent = `Falló en ${ETAPAS[nivel].nombre}`;
      $("#fin-texto").textContent = "Te quedaste sin vidas (código 137). Revisa la bitácora y vuelve a intentarlo.";
      $("#fin-boton").textContent = "Reintentar";
      hud.etapa.textContent = `Fallido · ${ETAPAS[nivel].nombre}`;
    }
    $("#fin-puntos").textContent = String(puntos);
    $("#fin-mejor").textContent = String(mejor);
    $("#fin-tiempo").textContent = `${Math.round(tiempoPartida)} s`;
    setTimeout(() => modo === "fin" && mostrarCapa("fin"), gano ? 1400 : 500);
  }

  // ---------- Entrada ----------
  const ACCIONES = {
    jugar,
    seguir,
    reanudar,
    menu: irAlMenu,
    ayuda: () => mostrarCapa("ayuda"),
    tema: () => aplicarTema(temaActual() === "dark" ? "light" : "dark"),
    sonido: () => {
      sonido.activo = !sonido.activo;
      almacen.escribir("hola-deploya-sonido", sonido.activo ? "1" : "0");
      sonido.despertar();
      pintarSonido();
    },
  };

  function pintarSonido() {
    const boton = document.querySelector('[data-accion="sonido"]');
    boton.querySelector("use").setAttribute("href", sonido.activo ? "#i-sonido" : "#i-mudo");
    boton.setAttribute("aria-label", sonido.activo ? "Silenciar" : "Activar sonido");
  }

  document.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-accion]");
    if (!boton) return;
    sonido.despertar();
    sonido.tono(700, 0.03);
    ACCIONES[boton.dataset.accion]?.();
  });
  hud.pausa.addEventListener("click", pausar);

  function aLogico(clientX) {
    const caja = lienzo.getBoundingClientRect();
    return ((clientX - caja.left) / caja.width) * ANCHO;
  }

  let arrastre = null;
  escenario.addEventListener("pointerdown", (e) => {
    if (modo !== "jugando" || e.target.closest(".capa")) return;
    e.preventDefault();
    sonido.despertar();
    escenario.setPointerCapture(e.pointerId);
    arrastre = { id: e.pointerId, ultimoX: e.clientX, recorrido: 0 };
    if (e.pointerType === "mouse") paleta.objetivo = aLogico(e.clientX);
  });
  escenario.addEventListener("pointermove", (e) => {
    if (modo !== "jugando") return;
    if (e.pointerType === "mouse") {
      paleta.objetivo = aLogico(e.clientX);
      return;
    }
    if (!arrastre || arrastre.id !== e.pointerId) return;
    const escalaCss = lienzo.getBoundingClientRect().width / ANCHO;
    const dx = ((e.clientX - arrastre.ultimoX) / escalaCss) * SENSIBILIDAD_TOQUE;
    arrastre.ultimoX = e.clientX;
    arrastre.recorrido += Math.abs(dx);
    paleta.objetivo += dx;
  });
  const soltar = (e) => {
    if (!arrastre || arrastre.id !== e.pointerId) return;
    const fueToque = arrastre.recorrido < ARRASTRE_TOQUE_PX || e.pointerType === "mouse";
    arrastre = null;
    if (modo === "jugando" && fueToque) lanzar();
  };
  escenario.addEventListener("pointerup", soltar);
  escenario.addEventListener("pointercancel", () => (arrastre = null));

  const TECLAS = { ArrowLeft: "izquierda", a: "izquierda", A: "izquierda", ArrowRight: "derecha", d: "derecha", D: "derecha" };
  addEventListener("keydown", (e) => {
    if (TECLAS[e.key]) {
      teclas.add(TECLAS[e.key]);
      e.preventDefault();
      return;
    }
    if (e.key === " " && modo === "jugando") {
      e.preventDefault();
      lanzar();
    } else if (e.key === "Escape" || e.key === "p" || e.key === "P") {
      if (modo === "jugando") pausar();
      else if (modo === "pausa") reanudar();
    } else if (e.key === "Enter" && modo === "transicion") {
      e.preventDefault();
      seguir();
    }
  });
  addEventListener("keyup", (e) => TECLAS[e.key] && teclas.delete(TECLAS[e.key]));
  addEventListener("blur", () => teclas.clear());
  document.addEventListener("visibilitychange", () => document.hidden && pausar());
  addEventListener("resize", ajustarTamano);
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", (e) => {
    const guardado = almacen.leer("deploya-tema", "system");
    if (guardado === "system") aplicarTema(e.matches ? "dark" : "light", false);
  });

  // ---------- Arranque ----------
  let anterior = 0;
  function cuadro(ahora) {
    const dt = anterior ? Math.min(DT_MAX, (ahora - anterior) / 1000) : 0;
    anterior = ahora;
    actualizar(dt);
    dibujar();
    requestAnimationFrame(cuadro);
  }

  aplicarTema(temaActual(), false);
  pintarSonido();
  ajustarTamano();
  pintarHud();
  irAlMenu();
  requestAnimationFrame(cuadro);
})();
