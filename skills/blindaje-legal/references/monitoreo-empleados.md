# 12. Monitoreo electrónico de empleados (EE. UU.)

Aplica a apps **internas** de ponche, control de horas, flotas o productividad que capturen
foto, GPS, pantalla, correo, llamadas o uso de internet del personal. En estos proyectos suele
ser la única obligación legal que queda: los chequeos de público (COPPA, CAN-SPAM, CCPA,
cookies) no aplican.

## Nueva York: Civil Rights Law §52-c (verificado 2026-10-14)

- **A quién obliga:** a todo empleador privado con sede en NY, **de cualquier tamaño**.
- **Qué cubre:** el monitoreo de teléfono, correo o internet de un empleado «by any electronic
  device or system, including … photoelectronic or photo-optical systems». La ley no nombra el
  GPS. La lectura conservadora lo incluye cuando el teléfono transmite la ubicación.
- **Qué exige:**
  1. aviso escrito al contratar;
  2. acuse del empleado, por escrito o electrónico;
  3. aviso colocado a la vista.
- **Texto del aviso:** debe decir que el uso «may be subject to monitoring at any and all times
  and by any lawful means».
- **Multas:** 500, 1.000 y 3.000 USD, las cobra el Fiscal General. No hay acción privada.
- **Fuente:** https://newyork.public.law/laws/n.y._civil_rights_law_section_52-c*2

## Otros estados con aviso obligatorio ⚠️ (no verificados en fuente primaria)

| Estado | Ley | Qué exige |
|---|---|---|
| Connecticut | Gen. Stat. §31-48d | Aviso previo y aviso colocado |
| Delaware | 19 Del. C. §705 | Aviso y acuse, o aviso diario al iniciar sesión |

Para cualquier otro estado, investigar antes de afirmar que no hay obligación.

## Fix

- **Sin tocar código:** escribir el aviso en `docs/` en el idioma del personal (y en inglés),
  con lo que la app **registra de verdad**, leído del código:
  - foto o no;
  - un punto GPS o seguimiento continuo;
  - quién lo ve;
  - para qué se usa.

  Añadir una hoja de acuse con nombre, firma y fecha, y dejar como pendiente del usuario
  imprimirla, colocarla y recoger las firmas.
- **Acuse dentro de la app:** necesita una columna nueva (fecha de acuse y versión del texto).
  Es un cambio de esquema, así que se propone y no se construye sin el sí.
- **Biométricos:** si la foto se usa para reconocimiento facial, aplican leyes biométricas, por
  ejemplo la BIPA de Illinois o la ley de NYC. Eso es otro chequeo: avisar e investigar.
