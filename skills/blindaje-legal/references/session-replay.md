# 3. Grabación de sesiones

**EE. UU.:** las demandas se basan en CIPA **§631** (wiretapping; 5.000 USD por infracción,
§637.2). SB 690 (firmada 30 sep 2026, vigente 1 ene 2027) sólo quita la acción privada por
§638.51 — **no toca §631** ⚠️ (leído en firmas jurídicas, leginfo bloqueado). *Popa v.
Microsoft* (9º Cir., 26 ago 2025) archivó por falta de daño concreto cuando no se graba
nada sensible: ayuda en tribunal federal, no en estatal.
**UE:** el JS de replay accede al dispositivo (ePrivacy 5(3), EDPB Guidelines 2/2023 v2)
→ **consentimiento previo**.

Regla de la skill: **apagado por defecto, todo enmascarado, sólo tras consentimiento**.
Si nadie mira las grabaciones, quitar el SDK.

## Banderas rojas

`maskAllInputs: false`, `maskAllText: false`, `blockAllMedia: false`, `unmask: [...]`
amplio, `data-clarity-unmask`, `.fs-unmask`, `data-hj-allow`, `defaultInputMode: 0`,
`obscureInputNumbers: false`, replay iniciado en `init` sin consentimiento.

## Por herramienta

**PostHog** — texto NO enmascarado por defecto.
```js
posthog.init(KEY, {
  opt_out_capturing_by_default: true,   // o cookieless_mode: 'on_reject'
  disable_session_recording: true,
  session_recording: { maskAllInputs: true, maskTextSelector: '*' },
})
// consentir:   posthog.opt_in_capturing(); posthog.startSessionRecording()
// retirar:     posthog.opt_out_capturing(); posthog.stopSessionRecording()
```
Excluir elementos: clase `ph-no-capture`.

**Sentry Replay** — defaults ya privados (`maskAllText`, `maskAllInputs`, `blockAllMedia`
en `true`); el Loader trae `replaysSessionSampleRate: 0.1`.
```js
// Las tasas no hacen nada sin la integración; la integración sólo se añade tras consentir.
Sentry.init({ dsn, replaysSessionSampleRate: 0.1, replaysOnErrorSampleRate: 1.0 })  // sin replayIntegration
// consentir:
Sentry.addIntegration(Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }))
```
Quitar replay = quitar `replayIntegration`; el SDK de errores se queda.
⚠️ `Sentry.getReplay()?.start()` y `lazyLoadIntegration` no confirmados en la doc leída.

**LogRocket** — sanitizers apagados por defecto; `init` sólo tras consentir:
```js
LogRocket.init(APP_ID, { dom: { inputSanitizer: true, textSanitizer: true } })
```
Elementos: `data-private`; `privateAttributeBlocklist` está deprecada → `dom.redactSelectors`.

**Microsoft Clarity** — enmascarado en el **panel**: Settings → Masking → **Strict**
(pendiente del usuario). Sin consentimiento sigue grabando sin cookies: en la UE **no
cargar el script** hasta consentir. Señal: `window.clarity('consentv2', { ad_Storage, analytics_Storage })`;
retirar: `window.clarity('consent', false)`.

**Hotjar** ⚠️ (ayuda inaccesible) — cargar `static.hotjar.com` sólo tras consentir; en el
panel activar la supresión de todo el contenido.

**FullStory** — sin «Private by Default» no enmascara nada.
```js
window['_fs_capture_on_startup'] = false   // antes del snippet (o FS('init', { captureOnStartup: false }))
// consentir: FS('start')   retirar: FS('shutdown') en cada carga
```
Formularios: `.fs-exclude`. Pedir «Private by Default» en la organización.

**OpenReplay** — fijar `obscureTextNumbers: true, obscureInputDates: true,
respectDoNotTrack: true`, `defaultInputMode: 2`; `tracker.start()` sólo tras consentir.

## Fuentes

- EDPB 2/2023 v2: https://www.edpb.europa.eu/system/files/documents/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf
- Clarity consent mode: https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-mode
- Docs: posthog.com/docs/session-replay/privacy · docs.sentry.io/platforms/javascript/session-replay/privacy · docs.logrocket.com/reference/dom · developer.fullstory.com · docs.openreplay.com/en/sdk/constructor
