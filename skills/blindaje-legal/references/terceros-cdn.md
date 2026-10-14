# 2. Fuentes y CDNs de terceros (GDPR)

**LG München I, 20 ene 2022, 3 O 17493/20**: cargar Google Fonts desde Google pasa la IP
(dato personal) sin consentimiento; **no hay interés legítimo porque se pueden alojar en
el propio servidor**. 100 € de daño inmaterial + orden de cese. Le siguió una ola de miles
de cartas de reclamación (100-170 €). El riesgo real es la reclamación en masa; el arreglo
es trivial. Mismo razonamiento para cualquier tercero evitable.

Aplica si hay usuarios en la UE/EEE.

## Patrones (también en `dist/`, `.next/`, `build/` si están versionados)

```
fonts.googleapis.com|fonts.gstatic.com|@import url\(.*googleapis
use.typekit.net|kit.fontawesome.com|use.fontawesome.com
unpkg.com|cdn.jsdelivr.net|cdnjs.cloudflare.com|ajax.googleapis.com|code.jquery.com
gravatar.com|react-gravatar
youtube.com/embed|youtu.be|i.ytimg.com|react-youtube|react-player|player.vimeo.com
maps.googleapis.com|google.com/maps/embed|@react-google-maps/api|@vis.gl/react-google-maps|google-map-react
www.google.com/recaptcha
```

**No es hallazgo:** `next/font/google` (descarga en build; «No requests are sent to Google
by the browser»).

## Fix

- **Next.js:** `next/font/google` o `next/font/local`; quitar `<link>`/`@import` a Google.
- **Vite/npm:** `pnpm add @fontsource-variable/<fuente>` + `import '@fontsource-variable/<fuente>'`
  (no variable: `@fontsource/<fuente>` + `import '@fontsource/<fuente>/400.css'`).
- **HTML estático/WordPress:** descargar con google-webfonts-helper
  (gwfh.mranftl.com) a `/fonts/` + `@font-face { … font-display: swap; }`. Borrar los
  `preconnect` a `fonts.gstatic.com`.
- **Librerías por CDN:** instalar por npm y empaquetar, o copiar a `/vendor/`.
- **YouTube/Vimeo:** fachada de clic (miniatura propia; el iframe se carga al clic o tras
  consentir). `youtube-nocookie.com` solo no basta: la IP sigue llegando.
- **Google Maps:** imagen estática propia + enlace, o iframe/SDK tras clic/consentimiento.
- **Gravatar:** avatar con iniciales, o proxy en servidor con caché.
- **reCAPTCHA:** cargarlo sólo en el formulario que lo usa, o una alternativa sin
  terceros; mencionarlo en la política.

## Fuentes

- Sentencia: https://www.gesetze-bayern.de/Content/Document/Y-300-Z-GRURRS-B-2022-N-612
- Next.js Font (2026-09-24): https://nextjs.org/docs/app/api-reference/components/font
