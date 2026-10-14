# 1. Verificación de edad en el registro (COPPA)

15 USC 6501; 16 CFR 312. Regla enmendada vigente desde el 23 jun 2025; cumplimiento
exigible desde el **22 abr 2026**.

## Cuándo aplica

- Servicio **dirigido a menores de 13** (tema, personajes animados, música, edad de los
  modelos, audiencia real) o de **audiencia mixta**.
- Audiencia general con **conocimiento real** de un menor de 13 (lo declaró en el age
  gate, lo avisó un padre). Que algún niño entre no lo vuelve «dirigido a niños».
- Proyecto de audiencia general sin campo de edad: no inventar un age gate salvo que el
  usuario lo pida o haya señales de público infantil. Reportarlo como «no aplica».

## Age screen neutral (FAQ D.7, H.3)

Hallazgo si falta cualquiera:
- Fecha de nacimiento completa, **sin valor por defecto**; el desplegable de años no
  empieza ni se limita a ≥ 13.
- **No** casilla «Tengo 13+» / «Soy mayor de 12».
- **No** avisar antes de que los menores no pueden registrarse (incita a mentir).
- **Sin reintento**: al declarar < 13, guardar cookie de larga duración
  (`age_gate=under13`) y bloquear volver atrás y cambiar la fecha.
- No pedir datos personales antes de la edad.
- Audiencia mixta: no bloquear al niño; desviarlo a un flujo sin datos o con
  consentimiento parental verificable.
- Un problema matemático no es un filtro de edad.
- Validar también en el servidor.

## Lo nuevo de 2025 que afecta al código

- Consentimiento parental **separado** para revelar datos a terceros (publicidad), salvo
  que sea parte integral del servicio.
- Información personal incluye **biométricos** (foto, voz, video) e identificadores de
  gobierno.
- **Política de retención** escrita y publicada en el aviso de privacidad; prohibido
  retener indefinidamente.
- **Programa escrito de seguridad** (§312.8).
- Política FTC del 25 feb 2026: no perseguirá datos recogidos **sólo para verificar la
  edad** si se usan sólo para eso, se borran pronto y se protegen.

## Fix

- Reemplazar checkbox/desplegable sesgado por campos de fecha vacíos y obligatorios.
- < 13: cookie + flag de servidor, no persistir PII, flujo sin cuenta o de consentimiento
  parental.
- Desactivar píxeles y anuncios personalizados para < 13 (AdMob/Google Ads:
  `tagForChildDirectedTreatment`).
- Añadir sección de retención a la política de privacidad.

## Fuentes

- 90 FR 16918 (22 abr 2025): https://downloads.regulations.gov/FTC-2024-0003-0281/content.htm
- FAQ COPPA: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- Política de verificación de edad (25 feb 2026): https://www.ftc.gov/legal-library/browse/enforcement-policy-statement-promoting-adoption-age-verification-technology
