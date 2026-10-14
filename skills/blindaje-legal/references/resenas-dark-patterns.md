# 10. Reseñas falsas y dark patterns

## FTC Consumer Reviews and Testimonials Rule (16 CFR 465, vigente desde 21 oct 2024)

Hasta 53.088 USD por infracción; cartas de advertencia a 10 empresas el 22 dic 2025.
Prohíbe: reseñas o testimonios falsos (**incluidas las generadas por IA**) o de quien no usó
el producto (465.2); reutilizar reseñas de otro producto (465.3); incentivos condicionados a
reseña positiva (465.4); reseñas de empleados sin revelarlo (465.5); webs de reseñas
«independientes» propias (465.6); **mostrar las publicadas como todas cuando se ocultaron
las negativas** (465.7); seguidores, likes o vistas falsas (465.8).

## Dark patterns

- FTC «Bringing Dark Patterns to Light» (sep 2022, guía de aplicación de la Sección 5 y
  ROSCA): urgencia o escasez falsas, cargos ocultos (drip pricing), fácil alta y difícil
  baja, opciones de privacidad asimétricas, confirmshaming, preselección.
- UE: DSA art. 25 sólo para **plataformas online** (y ⚠️ exime a micro y pequeñas
  empresas); para una tienda B2C rige la Directiva 2005/29 de prácticas desleales.

## Patrones

```
const (testimonials|reviews) = \[   + nombres genéricos, randomuser.me, pravatar, unsplash, "Lorem"
rating: 5 constante | aggregateRating en JSON-LD sin datos reales
\.filter\(.*rating\s*>=\s*4 | rating >= 4 en la query pública
Math.random\(\) cerca de viewing|stock|left|watching
setInterval / localStorage que reinicia un temporizador de oferta
(checked|defaultChecked) en marketing|newsletter|consent|terms
"No thanks, I don't|No, prefiero"  (confirmshaming)
"As seen on" / logos de prensa sin fuente
```

## Fix

- Testimonios inventados → reseñas reales de la base o quitar la sección. Nunca generar
  reseñas de ejemplo que lleguen a producción; los placeholders fuera del build.
- Mostrar todas las reseñas o declarar el criterio; marcar «incentivada» / «empleado».
- Contadores aleatorios → stock real o eliminarlos. Temporizadores sólo si la oferta
  caduca de verdad.
- Casillas sin marcar; Rechazar con la misma prominencia que Aceptar; baja con los mismos
  pasos que el alta; textos de rechazo neutros.
- `aggregateRating` sólo con datos reales.

## Fuentes

- https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers
- https://www.ftc.gov/reports/bringing-dark-patterns-light
