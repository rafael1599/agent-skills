---
name: cdp-ui-check
description: >
  Verificación visual e interactiva de una web local (o cualquier URL) con Chrome headless,
  sin depender de la extensión Claude in Chrome. Usar cuando haya que capturar o ejercitar
  una UI que corre en localhost, cuando la extensión de Chrome falle con "Frame is showing
  error page" o no cargue 127.0.0.1, o cuando se necesite consola limpia / screenshots
  reproducibles. Triggers: "screenshot de la app", "verifica la UI", "revisa cómo se ve",
  "la extensión de chrome no carga localhost", "captura la página", "/cdp-ui-check".
allowed-tools:
  - Bash
  - Read
  - Write
metadata:
  category: web-dev
  tags:
    - chrome
    - headless
    - cdp
    - screenshot
    - localhost
---

# cdp-ui-check

Tres niveles, del más simple al más completo. En esta casa la extensión Claude in Chrome ha
fallado con `localhost` (la pestaña queda en "error page" sin que la petición llegue al
servidor): no insistir más de dos veces con la extensión; pasar directo a esto.

## 1. Screenshot simple (sin interacción)

```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --disable-gpu --hide-scrollbars --window-size=1400,2300 \
      --virtual-time-budget=3000 --screenshot=$SCRATCHPAD/pagina.png "http://127.0.0.1:5077/"
```

- `--window-size` alto (2300+) para páginas largas; luego leer el PNG con Read.
- `--virtual-time-budget` espera al JS inicial.

## 2. Consola del navegador (¿está limpia?)

```bash
"$CH" --headless=new --disable-gpu --enable-logging=stderr --v=0 \
      --virtual-time-budget=3000 --dump-dom "URL" 2>&1 >/dev/null | grep -i "console" | grep -v installwebapp
```

Sin salida = consola limpia.

## 3. Interacción real (tipear, click, leer el DOM, capturar)

Usar `scripts/cdp.py` (cliente CDP mínimo, sólo stdlib): levanta Chrome headless con
`--remote-debugging-port`, evalúa JS en la página y captura pantalla completa.

```python
import sys; sys.path.insert(0, "${CLAUDE_SKILL_DIR}/scripts")
from cdp import abrir, js, captura
proc, ws = abrir("http://127.0.0.1:5077/", out_dir=".")   # out_dir: perfil temporal de Chrome
try:
    js(ws, "document.querySelector('#campo').value = 'x'")
    js(ws, "document.querySelector('#campo').dispatchEvent(new Event('input', {bubbles: true}))")
    print(js(ws, "document.querySelector('#resultado').textContent"))
    captura(ws, "captura.png")            # página completa
finally:
    proc.terminate()
```

Patrones útiles:
- Simular tipeo reactivo: setear `.value` y despachar `new Event('input', {bubbles: true})`
  (y `change` para `<select>`). Un `.click()` sobre el elemento dispara los handlers.
- Esperar al fetch/debounce: `time.sleep(0.8)` después de la acción.
- Formularios POST previos (crear estado antes de abrir la página): `urllib.request` con
  `method="POST"` y leer el `Location` de la redirección.

## PDFs

`sips -s format png archivo.pdf --out p1.png` (Quartz, sólo página 1, respeta las fuentes) o
`pdftoppm -png -r 80 archivo.pdf pagina` (todas las páginas; ojo: no sustituye Helvetica-Bold,
la negrita puede verse normal — no es un bug del PDF).

## Qué NO hacer

- No usar la extensión Claude in Chrome para localhost si ya falló dos veces en la sesión.
- No dejar procesos de Chrome vivos: siempre `proc.terminate()` (o `pkill -f remote-debugging-port=9333`).
- No subir las capturas al repo del proyecto: van al scratchpad.

## Viewport de teléfono (aprendido 2026-08-28)

`--window-size=430,932 --screenshot` **no** maqueta a 430 px: Chrome headless calcula el layout a
~1400 y recorta, así que un botón "cortado" en esa captura no es un desborde real. Tampoco sirve
`abrir(url, ancho=430)` ni `captura()` (que vuelve a fijar el tamaño al documento). Lo que sí:

```python
proc, ws = abrir(url, out_dir=".")
ws.call("Emulation.setDeviceMetricsOverride", width=430, height=932, deviceScaleFactor=1, mobile=True)
time.sleep(2.5)
alto = int(js(ws, "document.documentElement.scrollHeight"))
ws.call("Emulation.setDeviceMetricsOverride", width=430, height=max(932, alto), deviceScaleFactor=1, mobile=True)
r = ws.call("Page.captureScreenshot", format="png")
open("phone.png", "wb").write(base64.b64decode((r.get("result") or r)["data"]))
```

Para comprobar un desborde de verdad, con la emulación puesta:
`document.documentElement.scrollWidth` debe ser igual a `innerWidth`, y
`[...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1)`
tiene que estar vacío.
