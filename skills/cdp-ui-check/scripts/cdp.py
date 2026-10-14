"""Cliente CDP mínimo (sólo stdlib) para manejar Chrome headless: evaluar JS y capturar pantalla.

    from cdp import abrir, js, captura
    proc, ws = abrir("http://127.0.0.1:8787/", out_dir=".")
    try:
        js(ws, "document.title")
        captura(ws, "pagina.png")
    finally:
        proc.terminate()
"""
import base64
import json
import os
import socket
import struct
import subprocess
import time
import urllib.request

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 9333


class WS:
    """WebSocket de cliente, a mano: handshake + frames de texto enmascarados."""

    def __init__(self, url):
        host, rest = url[5:].split("/", 1)
        h, p = host.split(":")
        self.s = socket.create_connection((h, int(p)))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.send((f"GET /{rest} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\n"
                     f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
                     f"Sec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.s.recv(4096)
        self.n = 0

    def send(self, method, **params):
        self.n += 1
        data = json.dumps({"id": self.n, "method": method, "params": params}).encode()
        mask = os.urandom(4)
        hdr = bytearray([0x81])
        L = len(data)
        if L < 126:
            hdr.append(0x80 | L)
        elif L < 65536:
            hdr.append(0x80 | 126); hdr += struct.pack(">H", L)
        else:
            hdr.append(0x80 | 127); hdr += struct.pack(">Q", L)
        self.s.send(bytes(hdr) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))
        return self.n

    def _exact(self, n):
        b = b""
        while len(b) < n:
            c = self.s.recv(n - len(b))
            if not c:
                raise ConnectionError("Chrome cerró el WebSocket")
            b += c
        return b

    def recv(self):
        b1, b2 = self._exact(2)
        L = b2 & 0x7F
        if L == 126:
            L = struct.unpack(">H", self._exact(2))[0]
        elif L == 127:
            L = struct.unpack(">Q", self._exact(8))[0]
        return json.loads(self._exact(L))

    def call(self, method, **params):
        i = self.send(method, **params)
        while True:
            m = self.recv()
            if m.get("id") == i:
                if "error" in m:
                    raise RuntimeError(m["error"])
                return m.get("result", {})


def abrir(url, out_dir=".", espera=1.5, ancho=1400, alto=1000):
    """Lanza Chrome headless con un perfil temporal y navega a `url`. Devuelve (proceso, ws)."""
    perfil = os.path.join(out_dir, "perfil-chrome")
    proc = subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
         f"--remote-debugging-port={PORT}", f"--user-data-dir={perfil}",
         f"--window-size={ancho},{alto}", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    tabs = None
    for _ in range(50):
        try:
            tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json"))
            break
        except Exception:
            time.sleep(0.2)
    if tabs is None:
        proc.terminate()
        raise RuntimeError("Chrome no levantó el puerto de depuración")
    ws = WS(next(t for t in tabs if t["type"] == "page")["webSocketDebuggerUrl"])
    ws.call("Page.enable")
    ws.call("Runtime.enable")
    ws.call("Page.navigate", url=url)
    time.sleep(espera)
    return proc, ws


def js(ws, expr):
    """Evalúa JS en la página y devuelve el valor (lanza si el JS lanza)."""
    r = ws.call("Runtime.evaluate", expression=expr, awaitPromise=True, returnByValue=True)
    if "exceptionDetails" in r:
        detalle = r["exceptionDetails"].get("exception", {}).get("description", r["exceptionDetails"])
        raise RuntimeError(detalle)
    return r["result"].get("value")


def captura(ws, ruta, completa=True, ancho=1400):
    """Captura PNG; con `completa`, ajusta el alto al contenido (página entera)."""
    if completa:
        m = ws.call("Page.getLayoutMetrics")["cssContentSize"]
        ws.call("Emulation.setDeviceMetricsOverride", width=ancho, height=int(m["height"]),
                deviceScaleFactor=1, mobile=False)
    r = ws.call("Page.captureScreenshot", format="png")
    with open(ruta, "wb") as f:
        f.write(base64.b64decode(r["data"]))
