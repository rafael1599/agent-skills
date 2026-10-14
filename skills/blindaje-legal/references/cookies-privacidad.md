# 7. Cookies, consentimiento y CCPA/GPC

## UE/UK: ePrivacy 5(3) + GDPR

Cubre cualquier lectura/escritura en el dispositivo (cookies, `localStorage`, píxeles,
JS que recoge datos), no sólo cookies (EDPB 2/2023 v2). Requisitos verificables:

1. **Nada no esencial se ejecuta antes del consentimiento.**
2. **«Rechazar» en la misma capa y con la misma prominencia que «Aceptar»**; un enlace de
   texto pequeño no vale; sin casillas premarcadas ni «seguir navegando» (Cookie Banner
   Taskforce del EDPB, 17 ene 2023).
3. Retirar tan fácil como dar: enlace persistente «Preferencias de cookies».
4. Al rechazar o retirar, borrar lo ya escrito.

Esenciales sin consentimiento: sesión/auth, carrito, preferencia de consentimiento,
seguridad. Analítica, replay y publicidad no lo son.
`localStorage` para lo que el usuario pidió (borradores, preferencias de UI, modo de
trabajo) es esencial: no es hallazgo. `focus:outline-none` con `focus:ring-*` tampoco.

⚠️ El Digital Omnibus (propuesta del 19 nov 2025) movería las cookies al GDPR; no es ley.

### Patrones

```
gtag\('consent'|googletagmanager.com|google-analytics.com|GTM-|gtag\('config'|react-ga4|@next/third-parties
@vercel/analytics|cloudflareinsights|plausible|umami|mixpanel|amplitude|segment
fbq\(|connect.facebook.net|ttq\.|snap.licdn.com|static.hotjar.com|clarity.ms|criteo|adroll
cookieconsent|vanilla-cookieconsent|klaro|cookiebot|onetrust|iubenda|tarteaucitron|cookiehub
document.cookie|localStorage.setItem   (comprobar el propósito)
```
Banner con «Accept/Aceptar» y sin «Reject/Rechazar» en el mismo componente = hallazgo.

### Fix: Google Consent Mode v2 (antes del tag de Google)

```html
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied', ad_user_data: 'denied',
  ad_personalization: 'denied', analytics_storage: 'denied',
  wait_for_update: 500
});
</script>
<!-- después gtag.js / GTM; al aceptar: gtag('consent','update',{...:'granted'}) -->
```
Recomendar modo **Basic** (no carga tags hasta la decisión). Scripts que no son de Google:
inyectarlos en el callback de aceptación o `<script type="text/plain" data-category="analytics">`
con el CMP. Sin CMP en el proyecto: `vanilla-cookieconsent` (MIT, sin terceros).
Exigir `ad_user_data`/`ad_personalization` en la UE es política de Google (mar 2024), no ley.

## EE. UU.: CCPA/CPRA y GPC

**Aplica** (dato del negocio, preguntarlo) si: ingresos > **26.625.000 USD**, o datos de
≥ 100.000 consumidores/hogares, o ≥ 50 % de ingresos por vender/compartir datos.
Píxeles de retargeting (Meta, TikTok, Google Ads, LinkedIn, Criteo, AdRoll) = «sharing».
Aunque no aplique, honrar GPC es barato y cubre ~12 estados (Colorado verificado; el
resto ⚠️).

Requisitos (regulaciones CPPA vigentes desde 1 ene 2026):
1. Enlace **«Do Not Sell or Share My Personal Information»** en header/footer, o
   **«Your Privacy Choices»** con el icono oficial (§7015, §7026).
2. **GPC** = opt-out válido para ese navegador, y para el usuario si está identificado
   (§7025). Que un usuario deje de enviarla no es volver a aceptar.
3. **Desde 2026 es obligatorio mostrar** que se honró: «Opt-Out Request Honored» + toggle
   en estado excluido (§7025(c)(6)).
4. El camino a la opción más privada no es más largo que el contrario (§7004).
5. ADMT/evaluaciones de riesgo: sólo aviso (decisiones sobre empleo, crédito, vivienda,
   educación, salud), no arreglo.

### Fix

```ts
// cliente, antes de cargar píxeles
const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
if (gpc) {
  // <persistir el opt-out según el repo>, y en el perfil si hay login
  (window as Window & { gtag?: (...args: unknown[]) => void }).gtag?.('consent', 'update', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  });
  // no inyectar fbq/ttq/etc.
}
```
Servidor: `request.headers.get('sec-gpc') === '1'` (Fetch, Next, Workers) o
`req.headers['sec-gpc'] === '1'` (Express/Node). Cualquier otro valor = sin señal.
- `/.well-known/gpc.json` (`application/json`): `{"gpc": true, "lastUpdate": "<YYYY-MM-DD>"}`.
- Página `/privacy-choices` con el toggle; enlace en el footer.
- ⚠️ El icono oficial lo publica la CPPA/Fiscal General de CA: descargarlo de su web, no
  dibujarlo.

## Fuentes

- EDPB Cookie Banner Taskforce: https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf
- Google consent mode: https://developers.google.com/tag-platform/security/guides/consent
- Regulaciones CPPA (2026): https://cppa.ca.gov/regulations/pdf/ccpa_updates_cyber_risk_admt_appr_text.pdf
- Umbrales: https://www.cppa.ca.gov/regulations/cpi_adjustment.html · GPC: https://www.w3.org/TR/gpc/
