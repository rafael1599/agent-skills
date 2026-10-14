# 4. Emails de marketing (CAN-SPAM + Gmail/Yahoo)

15 USC 7701; 16 CFR 316. Multa hasta **53.088 USD por email** (sin ajuste en 2026, aviso
FTC del 15 sep 2026). Aplica también a B2B.

## Comercial vs transaccional

Transaccional (sólo exige encabezados veraces), lista cerrada: confirmar una transacción;
garantía, retiro o seguridad; cambios de cuenta, términos o saldo; empleo o beneficios;
entrega de lo comprado. Un email mixto es comercial si el asunto anuncia publicidad o lo
transaccional no va primero.

## Requisitos (hallazgo si falta cualquiera en los de marketing)

1. From, Reply-To y enrutamiento veraces; asunto no engañoso.
2. Identificado como publicidad (salvo consentimiento previo afirmativo).
3. **Dirección postal válida** del remitente (calle, apartado USPS o PMB de una CMRA).
4. **Aviso de baja claro** y mecanismo que funcione ≥ **30 días** tras el envío; menú
   permitido si una opción es «todo».
5. Baja cumplida en **10 días hábiles**; sin cobro, sin login, sin pedir más que el email;
   no vender ni transferir direcciones dadas de baja.
6. Gmail/Yahoo (obligatorio > 5.000/día, buena práctica para todos): encabezados
   `List-Unsubscribe: <https://…>` y `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
   (RFC 8058), SPF + DKIM + DMARC alineados con el From, spam < 0,3 %. Yahoo pide
   procesar la baja en 2 días.

## Patrones

`resend`, `@sendgrid/mail`, `@mailchimp/mailchimp_marketing`, `mailchimp-transactional`,
`postmark`, `nodemailer`, `@aws-sdk/client-ses`, `mailgun.js`, `brevo`, `sib-api-v3-sdk`,
`customerio`, `loops`, `@react-email/*`; plantillas de newsletter, crons de campañas,
`marketing_opt_in`, `newsletter`.

Si el email lo envía una plataforma de marketing (Mailchimp, Brevo, Loops) con su propio
footer de baja, verificar que la dirección postal esté configurada en su panel → pendiente
del usuario.

## Fix

- Separar helpers de envío transaccional y de marketing (idealmente subdominio/stream).
- Marketing: añadir los dos encabezados `List-Unsubscribe*` en `headers` del SDK.
- Endpoint `POST /unsubscribe?token=` idempotente y sin login (responde 200 al POST
  one-click) + página GET para la baja manual. Token firmado que no caduque antes de 30 días.
- Tabla/columna de supresión; comprobarla **antes de cada envío**.
- Footer: razón social, `<DIRECCION_POSTAL>` desde la config legal, enlace de baja.
- Checkbox de marketing **sin marcar** en el registro.

## Fuentes

- FTC CAN-SPAM guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- Google sender guidelines: https://support.google.com/a/answer/81126 · Yahoo: https://senders.yahooinc.com/best-practices/
