---
name: blindaje-legal
version: 1.0.0
license: MIT
author: "Rafael Lopez"
description: >
  Audita un proyecto web o app en busca de riesgos legales y los arregla en el código:
  verificación de edad (COPPA), fuentes y CDNs de terceros (GDPR, Google Fonts),
  grabación de sesiones, emails de marketing (CAN-SPAM), suscripciones y renovación
  automática (ROSCA, ley de California), agente DMCA, cookies y consentimiento, CCPA/GPC,
  accesibilidad (WCAG 2.2), política de privacidad, términos, borrado de cuenta en tiendas,
  y reseñas falsas o dark patterns. Detecta primero qué tiene el proyecto y sólo aplica
  los chequeos que corresponden; termina con la lista de cambios y archivos tocados.
  Triggers: "blinda mi app", "riesgos legales", "auditoría legal", "compliance", "GDPR",
  "COPPA", "CAN-SPAM", "DMCA", "cookies y consentimiento", "banner de cookies", "política de privacidad",
  "términos y condiciones", "accesibilidad legal", "click to cancel", "/blindaje-legal".
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
---

# blindaje-legal

Auditor y arreglador. **No sustituye a un abogado**: decirlo una vez en el informe final,
no en cada párrafo. Los textos legales que se generen son **borradores**; nunca escribir
«cumple GDPR/CCPA/ADA» en la app ni en el informe (es lo que le costó 1 M USD a accessiBe).

Research con fuentes primarias a **2026-10-13**. Lo marcado ⚠️ en `references/` no se pudo
leer en fuente primaria o puede haber cambiado: si un hallazgo depende de ello, decirlo.

## Instrucciones

### 1. Detectar qué tiene el proyecto

```bash
bash "<SKILL_DIR>/scripts/detectar.sh" <RAIZ_DEL_PROYECTO>
```

Imprime, por chequeo, si aplica y las líneas que lo disparan (sólo código y config;
excluye builds, `docs/`, `.md` y carpetas de agentes). Descartar lo que no llega al
usuario (`scripts/`, `reports/`, generadores) y los countdowns que no son ofertas. Es un punto de partida: leer los archivos que señala
antes de concluir. Si el script no detecta un stack (p. ej. backend en otro repo), buscar
a mano con los patrones de la referencia.

### 2. Preguntar sólo lo que el código no dice

Una pregunta en el chat, con default, y sólo si cambia qué chequeos aplican:

- **Jurisdicción:** el país del negocio y de su público. Deducirlo del código antes de
  preguntar (TLD, moneda, dirección, prefijo de WhatsApp). Default: UE + EE. UU.
  **Si es otro país**, leer `references/<país>.md`; si no existe, investigar su ley de
  datos personales y de consumo con fuentes primarias **antes de arreglar**, y guardar lo
  aprendido como referencia nueva. Las referencias de UE/EE. UU. no lo cubren (en un
  sitio `.pe` manda la ley peruana, con Libro de Reclamaciones).
- **¿Dirigido a niños menores de 13?** Default: no (audiencia general).
- **Datos del negocio** que no pueden inventarse: razón social, dirección postal, email
  legal, agente DMCA. Si faltan, usar placeholders `<RAZON_SOCIAL>`, `<DIRECCION_POSTAL>`,
  `<EMAIL_LEGAL>`, `<AGENTE_DMCA>`, `<EMAIL_DMCA>` en un único archivo de config del stack
  (`src/config/legal.ts`, o el JSON/plantilla equivalente en un sitio estático) y listarlos
  como pendientes. Nunca inventarlos.

Proyecto interno (login cerrado, sólo empleados, sin registro público): COPPA, CAN-SPAM,
suscripciones, DMCA, CCPA, reseñas, términos y borrado de cuenta no aplican. Siguen
aplicando:
- replay, y cookies si hay analítica;
- accesibilidad;
- con empleados en la UE, fuentes/CDNs y un aviso de privacidad para empleados (9a);
- en EE. UU., si la app captura foto, GPS o uso de internet del personal, el **monitoreo de
  empleados** (12).

Decirlo en una línea y seguir. Un registro que sólo se abre con invitación no es un registro
público.

### 3. Aplicar cada chequeo que aplica

Leer **sólo** la referencia del chequeo activo:

| # | Chequeo | Se activa si hay | Referencia |
|---|---|---|---|
| 1 | Edad en el registro (COPPA) | campo de edad/nacimiento, contenido o público infantil (un signup público sólo da contexto) | `references/coppa.md` |
| 2 | Fuentes y CDNs de terceros (**sólo con usuarios en la UE/EEE**: es GDPR) | `fonts.googleapis`, CDNs, YouTube, Maps, Gravatar, reCAPTCHA | `references/terceros-cdn.md` |
| 3 | Grabación de sesiones | PostHog, Sentry Replay, LogRocket, Clarity, Hotjar, FullStory, OpenReplay | `references/session-replay.md` |
| 4 | Emails de marketing | SDK de email + newsletter, campañas o `marketing_opt_in` | `references/email-marketing.md` |
| 5 | Suscripciones | Stripe/Paddle/LemonSqueezy/RevenueCat con cobro recurrente | `references/suscripciones.md` |
| 6 | DMCA | contenido subido por usuarios (uploads, posts, comentarios) | `references/dmca.md` |
| 7 | Cookies, consentimiento, CCPA/GPC | analítica, píxeles, `document.cookie` no esencial | `references/cookies-privacidad.md` |
| 8 | Accesibilidad | cualquier front | `references/accesibilidad.md` |
| 9 | Privacidad, términos (9a), borrado de cuenta (9b) | cualquier recogida de datos; 9b con `ios/`, `android/`, Expo, Capacitor | `references/paginas-legales.md` |
| 10 | Reseñas y dark patterns | testimonios, ratings, urgencia, casillas premarcadas | `references/resenas-dark-patterns.md` |
| 11 | Perú: Ley 29733, Libro de Reclamaciones, precios con IGV | `.pe`, `S/`, `IGV`, dirección en Perú | `references/peru.md` |
| 12 | Monitoreo electrónico de empleados (EE. UU.) | ponche o control de horas con foto/GPS en una app interna (la cámara sola no cuenta) | `references/monitoreo-empleados.md` |

Arreglar en el código siguiendo las convenciones del repo (su `CLAUDE.md`, sus
componentes, su idioma de UI). Texto visible al usuario en el idioma de la app.

### 4. Verificar

- Correr los tests y el typecheck del proyecto.
- Si hay front local: `npx @axe-core/cli` (ver `accesibilidad.md`) y comprobar en la
  pestaña Network (o con `curl` al HTML servido) que no salen peticiones a terceros antes
  del consentimiento.
- Las pruebas visuales en el navegador las hace el usuario: darle los pasos y el
  resultado esperado de cada uno.

### 5. Informe final

```
## Blindaje legal — <proyecto> (<fecha>)
Aplicaron: 2, 3, 7, 8, 9   ·   No aplicaron: 1 (sin registro público), 4, 5, 6, 10

| # | Riesgo | Cambio | Archivo(s) |
|---|---|---|---|
| 2 | Google Fonts por CDN filtra la IP (LG München 3 O 17493/20) | Self-host con @fontsource-variable/inter | index.html, src/main.tsx, package.json |

Pendiente del usuario: <datos del negocio, registro DMCA, ajustes de paneles (Clarity Strict, Hotjar)>
Requiere abogado: <cláusulas marcadas [REQUIERE ABOGADO]>
Esto es una revisión técnica, no asesoría legal.
```

Una fila por cambio. Los ajustes que viven en paneles de terceros (no en el código) van
en «Pendiente del usuario» con la ruta exacta del menú.

## Decisiones

- **Arreglar, no sólo señalar**, salvo: lo que exige datos del negocio (placeholder +
  pendiente), cláusulas jurídicas (`[REQUIERE ABOGADO]`) y cambios que rompen un flujo de
  pago en producción (proponer el diff y pedir el sí).
- **Quitar antes que configurar**, pero preguntar antes si se usa. En Sentry se quita sólo
  `replayIntegration`, nunca el SDK de errores.
- **Nada no esencial carga antes del consentimiento**: si hay que elegir, no inyectar el
  script es más seguro que inyectarlo con una bandera de «denied».
- **Nunca generar reseñas, testimonios ni contadores** de ejemplo que lleguen a producción.
- **Overlays de accesibilidad** (accessiBe, UserWay, AudioEye, EqualWeb): quitarlos y
  arreglar el código.
- **No reescribir** una política o términos existentes enteros: añadir las secciones que
  faltan y marcar con fecha «Last updated».
- **Lo que ya dice la política o el aviso se contrasta con el código.** «No compartimos tus
  datos» con un formulario que va a Web3Forms, o «analítica sin cookies» cuando el beacon
  ya no existe, es una afirmación falsa: corregirla es el primer arreglo.
- **Si hay placeholders visibles** (titular, código de registro), el PR dice «no mergear»
  hasta rellenarlos.
- Un hallazgo cuya base esté marcada ⚠️ va en el informe con «verificar vigencia».

## Errores comunes

- `next/font/google` **no** es un hallazgo: descarga las fuentes en el build (docs de
  Next.js). Sí lo es un `<link>` a `fonts.googleapis.com` en `layout`/`_document` o un
  `@import` en CSS.
- `youtube-nocookie.com` no evita que la IP llegue a Google: hace falta fachada de clic.
- Clarity sin consentimiento sigue grabando en «modo sin consentimiento»: en la UE no
  cargar el script, no basta `consentv2: denied`.
- `@axe-core/cli` falla con «chromedriver» → `npx browser-driver-manager install chrome`.
- Contraste que cambia entre corridas (1.34, luego 1.56) = axe midió una animación de
  entrada a medias. Correr con `--chrome-options="force-prefers-reduced-motion"`.
- `pa11y` 10 pide Node ≥ 22.13.
- La regla federal Click-to-Cancel **no está vigente** (anulada el 8 jul 2025): citar
  ROSCA y la ley de California, no la regla de la FTC.

## Referencias

Una por chequeo en `references/` (tabla del paso 3), cada una con sus fuentes primarias y
fecha. Principales: FTC (COPPA, CAN-SPAM, ROSCA, reseñas), copyright.gov (DMCA),
LG München I 3 O 17493/20, EDPB, CPPA, W3C WCAG 2.2, ada.gov.
