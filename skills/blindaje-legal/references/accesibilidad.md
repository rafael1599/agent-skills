# 8. Accesibilidad (WCAG 2.2 AA)

## Marco legal (2026-10-13)

- **ADA Title III** (webs privadas EE. UU.): sin regla técnica; riesgo = demandas privadas
  contra WCAG 2.1/2.2 AA.
- **ADA Title II** (gobiernos estatales/locales): WCAG **2.1** AA. Prórroga del 20 abr 2026:
  ≥ 50.000 hab. → **26 abr 2027**; resto → **26 abr 2028**. ⚠️ El DOJ anunció más revisión.
- **European Accessibility Act**: desde el 28 jun 2025 para servicios a consumidores
  (e-commerce, banca, e-books, transporte, comunicaciones). Exentas las **microempresas de
  servicios** (< 10 empleados y ≤ 2 M EUR). Estándar: EN 301 549 ≈ WCAG 2.1 AA.
- **Overlays no protegen:** orden final FTC v. accessiBe (22 abr 2025), 1 M USD por afirmar
  conformidad automática.

Objetivo de la skill: WCAG **2.2 AA** (incluye 2.1).

## Auditoría automática (cubre una parte; el resto, grep y lectura)

```bash
npx @axe-core/cli <URL> --tags wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa --chrome-options="force-prefers-reduced-motion" --exit
npx pa11y <URL> --standard WCAG2AA --runner axe --runner htmlcs --reporter json   # Node ≥ 22.13
npx lighthouse <URL> --only-categories=accessibility --output=json --output-path=./lh-a11y.json --chrome-flags="--headless=new"
```
Auditar las rutas principales (inicio, login, registro, checkout), no sólo `/`.

## Criterios nuevos de 2.2 (axe no los detecta bien salvo 2.5.8)

| Criterio | Nivel | Qué buscar | Fix |
|---|---|---|---|
| 2.4.11 Focus Not Obscured | AA | `position: fixed/sticky` (header, banner de cookies, chat) | `html { scroll-padding-top: <alto> }`; el banner no tapa el foco |
| 2.5.7 Dragging Movements | AA | `dnd-kit`, `react-beautiful-dnd`, `sortablejs` sin alternativa | botones Subir/Bajar o «Mover a…» (el sensor de teclado no basta) |
| 2.5.8 Target Size | AA | botones-icono < 24 px (`w-4 h-4`, `w-5 h-5`) | `min-width/min-height: 24px` o ampliar área con padding |
| 3.3.7 Redundant Entry | A | pasos que vuelven a pedir lo mismo | prellenar / «misma dirección» |
| 3.3.8 Accessible Authentication | AA | `onPaste` con `preventDefault`, password sin `autocomplete`, CAPTCHA de texto | permitir pegar, `autocomplete="username"/"current-password"/"new-password"`, magic link/passkey, Turnstile |

## Otros patrones baratos

```
acsbapp|accessibe|userway|audioeye|equalweb                 → quitar overlay
<img(?![^>]*alt=)                                          → alt
<div[^>]*onClick (sin role ni tabIndex)                    → <button>
outline:\s*(none|0) sin :focus-visible                     → foco visible
user-scalable=no|maximum-scale=1                           → permitir zoom (1.4.4)
outline-none (Tailwind) sin focus-visible:                 → foco visible
<html sin lang=                                            → lang
input sin <label> ni aria-label                            → label
```

Al quitar `maximum-scale`/`user-scalable=no`, iOS hace zoom automático en inputs con
fuente < 16 px: subir los inputs a `font-size: 16px` como mínimo (`text-base`) y pedir al
usuario que lo pruebe en el teléfono. En una PWA de escaneo, avisar antes de aplicarlo.

## Fuentes

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Regla Title II y prórroga: https://www.ada.gov/resources/2024-03-08-web-rule/
- Guía Title III (2022): https://www.ada.gov/resources/web-guidance/
- FTC v. accessiBe: https://www.ftc.gov/node/88115
