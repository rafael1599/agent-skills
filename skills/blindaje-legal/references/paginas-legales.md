# 9. Política de privacidad, términos y borrado de cuenta

## Política de privacidad (9a)

**Aplica** a toda web que recoja datos personales (formularios, auth, analítica, newsletter).
CalOPPA (B&P §22575) no tiene umbral de tamaño.

Hallazgo si falta: ruta `/privacy` (o equivalente), enlace con la palabra **«Privacy»** en
el footer global o la home, o alguna de estas secciones:

- **CalOPPA §22575(b):** categorías de datos y de terceros con quien se comparten; cómo
  revisar o corregir; cómo se avisa de cambios; **fecha de vigencia**; cómo responde a
  **Do Not Track**; si terceros rastrean entre sitios.
- **GDPR arts. 13-14** (si hay usuarios UE): responsable y contacto (y DPO si hay); fines
  **con base jurídica** por fin; destinatarios; transferencias internacionales y garantías;
  plazo de conservación; derechos (acceso, rectificación, supresión, limitación, oposición,
  portabilidad); retirar consentimiento; reclamar ante la autoridad; decisiones
  automatizadas.
- **COPPA 2025** (si aplica): política de retención.
- **CCPA** (si aplica): derechos de California y enlace a `/privacy-choices`.

Hallazgo también: una afirmación de la política que el código contradice (destinatarios,
analítica, cookies). **Fix:** rellenar con lo que **detecta el código** (SDKs, proveedores: Supabase, Cloudflare,
Stripe, Resend…; tablas con PII; cookies del chequeo 7). Datos del negocio como
placeholders. Fecha «Last updated». Si ya existe, añadir sólo lo que falta.

## Borrado de cuenta (9b, apps en tiendas)

Señales: `ios/`, `android/`, `app.json`/`app.config.*` (Expo), `capacitor.config.*`,
`pubspec.yaml`, más registro de usuarios.

- **Apple 5.1.1(i):** enlace a la política dentro de la app y en App Store Connect.
- **Apple 5.1.1(v):** si se crean cuentas, **borrado dentro de la app** (desactivar no
  basta; no obligar a llamar ni a escribir).
- **Google Play:** ruta de borrado dentro de la app **y URL web** pública que nombre la
  app, declarada en Data safety → Data deletion. Lo que se retiene se declara.

Hallazgo: hay `signUp`/`createUser` y ningún `deleteUser`/`delete-account`.
**Fix:** botón «Delete account» en ajustes → función de servidor que borra el usuario de
auth (service role), sus datos personales y sus ficheros de storage; confirmación previa;
página web `/delete-account`. Lo que la ley o el negocio obligan a retener (facturas,
órdenes, auditorías append-only, registros fiscales) se **anonimiza**, no se borra, y se
declara en Data safety. Un `ON DELETE CASCADE` nuevo se propone y se pide el sí.

## Términos de servicio

Claude **puede redactar**: identificación del operador, descripción del servicio, cuenta y
seguridad, uso aceptable, contenido del usuario y licencia para mostrarlo, propiedad
intelectual, política de reincidentes DMCA, cambios y terminación, «tal cual» como
borrador, contacto y fecha.

**Nunca redactar, sólo marcar `[REQUIERE ABOGADO]`:** arbitraje y renuncia a acciones
colectivas, ley aplicable y jurisdicción, topes de responsabilidad e indemnidades,
reembolsos y derecho de desistimiento UE, cláusulas sectoriales (salud, finanzas).

## Fuentes

- CalOPPA §22575 (leído en espejo, leginfo bloqueado ⚠️): https://california.public.law/codes/business_and_professions_code_section_22575
- Apple: https://developer.apple.com/app-store/review/guidelines/ · https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Google Play: https://support.google.com/googleplay/android-developer/answer/13327111
- GDPR (EUR-Lex bloqueado ⚠️, texto estable desde 2016): https://eur-lex.europa.eu/eli/reg/2016/679/oj
