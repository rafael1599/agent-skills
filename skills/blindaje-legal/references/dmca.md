# 6. Agente DMCA (17 USC 512(c); 37 CFR 201.38)

Aplica a todo servicio que **aloje contenido subido por usuarios**. Sin agente designado
y registrado no hay safe harbor de §512(c).

## Patrones

`multer`, `busboy`, URLs firmadas S3/R2, Supabase Storage, `uploadthing`, Cloudinary,
`<input type="file">` público, comentarios, posts, perfiles con foto, marketplaces.
Uploads sólo de empleados en una herramienta interna: no aplica.

## Requisitos

- **Página pública** (`/dmca` o `/copyright`) con: razón social y **dirección física** del
  proveedor (un apartado no sustituye la calle); nombre del agente (puede ser un cargo o un
  tercero); dirección postal (aquí vale apartado), teléfono y email del agente. Debe
  coincidir con el registro.
- **Registro** en https://dmca.copyright.gov/osp/ — **6 USD**, incluye nombres alternativos
  (marcas, dominios, apps); uno por entidad legal; **caduca a los 3 años** y al caducar se
  pierde el safe harbor. Renovar enmendando o reenviando (6 USD, otros 3 años).
- **Política de reincidentes** adoptada, aplicada y comunicada (términos).
- **Retirada rápida** ante notificación válida (§512(c)(3): firma, obra, material y
  ubicación, contacto, buena fe, declaración bajo pena de perjurio).
- **Contranotificación** (§512(g)): avisar al usuario, aceptar su contranotificación,
  enviarla al denunciante, restaurar en **10-14 días hábiles** salvo aviso de demanda.

## Fix

- Página `/dmca` con los datos desde la config legal + instrucciones de notificación y
  contranotificación; enlace en footer y términos.
- Email dedicado (`<EMAIL_DMCA>`) o formulario.
- Si el proyecto tiene base de datos: tabla `takedowns` (estado, fechas, `user_id`,
  `strike_count`), ocultar el objeto al retirarlo y restaurarlo al vencer el plazo.

## Cómo registrar (pasos para el usuario)

1. Crear cuenta en https://dmca.copyright.gov/osp/ (no hay papel desde dic 2016).
2. «Designate a new agent»: razón social, dirección física, nombres alternativos, datos
   del agente.
3. Pagar 6 USD. Guardar el número `DMCA-xxxxxxx` y la fecha de vencimiento.
4. Calendario a 2 años y 11 meses para renovar.

No hay API para comprobar el registro: pedir al usuario el número y la fecha y anotarlos
en el informe.

## Fuentes

- Directorio: https://www.copyright.gov/dmca-directory/ · tarifas: https://www.copyright.gov/about/fees.html
- 17 USC 512: https://www.copyright.gov/title17/92chap5.html · 37 CFR 201.38 (eCFR)
