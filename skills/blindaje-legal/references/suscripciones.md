# 5. Suscripciones y renovación automática

## Estado legal (2026-10-13)

- **Regla federal Click-to-Cancel: NO vigente.** Anulada entera por el 8º Circuito el
  8 jul 2025 (*Custom Communications v. FTC*). La FTC devolvió 16 CFR 425 a su versión
  previa (12 feb 2026) y abrió un ANPRM (13 mar 2026). ⚠️ Comprobar si hubo propuesta nueva.
- **ROSCA (15 USC 8403), vigente:** (1) términos materiales claros **antes de pedir los
  datos de pago**; (2) consentimiento expreso **antes de cobrar**; (3) forma simple de
  detener los cobros.
- **California ARL (B&P §17600 y ss., con AB 2863)**, para contratos desde el 1 jul 2025.
  Es la referencia más estricta; ~30 estados tienen leyes propias.

## Requisitos (California como estándar)

- Términos de renovación **en proximidad visual** del botón de suscripción: que se renueva
  hasta cancelar, importe y frecuencia, duración de la prueba y precio después, cómo cancelar.
- **Consentimiento afirmativo** a la renovación antes de cobrar.
- **Email de confirmación** con términos y cómo cancelar.
- **Cancelar por el mismo medio**: quien se suscribió online cancela online, sin llamar ni
  chatear. Si hay oferta de retención, botón «Cancelar» visible todo el tiempo.
- Recordatorio **anual**; aviso de **cambio de precio** 7-30 días antes; aviso previo a la
  renovación 15-45 días si el plazo es ≥ 1 año, y 3-21 días antes del fin de una prueba de
  más de 31 días ⚠️ (alerta del Fiscal General de CA; texto de la ley no leído).
- ⚠️ Guardar prueba del consentimiento: muy probable bajo AB 2863, no verificado en el texto.
  Guardarla igual: no cuesta y sirve ante ROSCA.

## Patrones

`stripe` (`subscriptions.create`, `mode: 'subscription'`, `trial_period_days`,
`billingPortal`), `@paddle/paddle-js`, `@lemonsqueezy/*`, `chargebee`, `recurly`,
RevenueCat, `react-native-iap`, StoreKit; páginas `/pricing`, `/billing`; flujos de
cancelación con encuestas o «¿seguro?».

## Fix

- **Checkout:** junto al botón, bloque legible (no menor que el texto del botón):
  «Se renueva automáticamente cada {interval} por {amount} hasta que canceles. Cancela
  en {ruta}.» Valores desde el `price` real, nunca hardcodeados. Casilla **sin marcar**
  y obligatoria de aceptación de la renovación.
- Guardar `consent_at`, versión del texto, `price_id` (e IP si el proyecto ya la guarda).
- **Cancelar** en ≤ 2 clics desde la cuenta: `stripe.subscriptions.update(id, { cancel_at_period_end: true })`
  o el Customer Portal con cancelación activada.
- **Emails:** confirmación al suscribirse; recordatorio anual y aviso de renovación/cambio
  de precio con webhook `invoice.upcoming` o cron.
- **Apps iOS/Android con compras de la tienda:** la cancelación la gestiona la tienda;
  enlazar a ella desde ajustes.
- Cambios en un checkout de producción: proponer el diff y pedir el sí antes de aplicar.

## Fuentes

- FTC ANPRM (11 mar 2026): https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-seeks-public-comment-response-advance-notice-proposed-rulemaking-regarding-negative-option
- ROSCA: https://uscode.house.gov (15 USC 8403)
- AB 2863: https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240AB2863
- Alerta del Fiscal General de CA (4 sep 2025): https://oag.ca.gov/news/press-releases/attorney-general-bonta-issues-consumer-alert-california%E2%80%99s-automatic-renewal-law
