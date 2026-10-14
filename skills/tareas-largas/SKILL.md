---
name: tareas-largas
description: >
  Cómo lanzar, vigilar y reportar comandos largos en segundo plano (instalaciones pesadas
  como PyTorch/CUDA, entrenamientos, descargas de gigas) sin mentir sobre el progreso y
  sin matar la cadena de la sesión. Usar SIEMPRE que se lance un pip install grande, un
  entrenamiento, una descarga larga o cualquier proceso que tarde minutos/horas, y antes
  de decirle al usuario que "sigue avanzando", "ya casi" o "terminó". Triggers: pip
  install torch, instalación que tarda, descarga de varios gigas, entrenamiento, proceso
  en segundo plano, exit 144, "aún no termina", "no confío", proceso que murió solo,
  nohup/setsid/disown.
---

# Lanzar y vigilar tareas largas sin equivocarse

Lección que originó esta skill: una instalación de PyTorch lanzada en segundo
plano con `--quiet` se reportó como "en progreso" durante horas cuando en realidad
**el proceso había muerto en silencio**: log vacío, ningún pip vivo, `torch` sin
instalar. Encima, al intentar relanzarla, un `pkill` dentro del comando **mató la
cadena claude→bash (exit 144)** y tampoco quedó nada. Dos errores: confiar en un
"parece que va" sin verificar, y usar `pkill` desde la sesión.

## Regla 1 — NUNCA `pkill`/`kill` desde la sesión

`pkill -f ...` o `kill` ejecutados dentro de la sesión suelen matar también el
proceso que corre el propio comando → **exit 144** y se aborta todo. Nunca
combinar limpieza-con-kill y relanzamiento en el mismo comando.
- Para limpiar restos: usar `rm -rf` de temporales, NO `pkill`.
- Si de verdad hay que matar un proceso, hacerlo en un comando aislado y asumir
  que puede devolver 144; el relanzamiento va SIEMPRE en un comando separado.

## Regla 2 — Lanzar desacoplado, con progreso y log persistente

Lanzar en un comando propio (sin pkill, sin `&&` con limpieza peligrosa):

```
PY=<RUTA_DEL_VENV>/bin/python
LOG=/tmp/mi_instalacion.log; : > "$LOG"
setsid nohup $PY -m pip install --progress-bar on <paquetes> >> "$LOG" 2>&1 < /dev/null & disown
echo "lanzado PID=$!"
```

- **Nunca `--quiet`** en algo que hay que vigilar: sin salida no se distingue
  "trabajando" de "muerto".
- Log a archivo propio (`/tmp/*.log`), no depender solo del task harness: las
  tareas de fondo pueden morir por eventos de sesión o reconexiones MCP.
- `setsid` + `nohup` + `< /dev/null` + `disown` para que sobreviva de verdad.

## Regla 3 — VERIFICAR antes de decir "va bien" o "terminó"

Un único "pip ACTIVO" NO prueba que vaya a terminar. Antes de cada afirmación al
usuario, comprobar las TRES cosas:
1. **Proceso vivo:** `ps -eo pid,etime,args | grep "<comando>" | grep -v grep`
   (el `etime` debe crecer entre revisiones).
2. **Avanza de verdad:** el log crece (`tail`), o el wheel temporal/site-packages
   cambia de tamaño, o hay socket de descarga (`ss -tnp | grep python`).
3. **Artefacto final:** sólo declarar éxito cuando el resultado IMPORTA/CORRE,
   p.ej. `python -c "import torch; print(torch.cuda.is_available())"` devuelve la
   versión y `True`. "Parece instalado" no basta.

Señales de **proceso MUERTO** (corregir y relanzar, decirlo con franqueza):
log de tamaño 0, ningún proceso pip/python del venv, artefacto ausente.

## Regla 4 — Honestidad de estado

Si una revisión revela que lo que se venía reportando como "en progreso" ya estaba
caído, **admitirlo de inmediato** y relanzar; nunca seguir narrando un avance que
no se ha vuelto a verificar. Si el usuario dice "no confío" o "lleva demasiado",
hacer el diagnóstico completo (Regla 3), no tranquilizarlo sin datos.
