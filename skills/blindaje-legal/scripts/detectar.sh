#!/usr/bin/env bash
# detectar.sh — Qué chequeos de blindaje-legal aplican a un proyecto.
# Uso: bash detectar.sh [RAIZ]   (por defecto, el directorio actual)
# Sólo lee archivos de código y config (no .md, no builds, no carpetas de agentes).
# Imprime por chequeo: APLICA / no detectado, y hasta MAX líneas que lo disparan.
# Patrones resumidos de references/*.md; si cambian allá, revisar acá.

set -u
ROOT="${1:-.}"
MAX="${MAX:-6}"
cd "$ROOT" || { echo "No existe $ROOT" >&2; exit 1; }

EXTS=(ts tsx js jsx mjs cjs vue svelte astro html htm css scss sass less php py rb go
      swift kt kts java dart erb liquid njk hbs ejs toml yaml yml plist xml)
SKIP_DIRS=(node_modules .git dist build out .next .nuxt .svelte-kit .output coverage vendor
           .turbo .vercel .netlify Pods playwright-report test-results .agent .agents .claude
           .cursor .github docs storybook-static)

if command -v rg >/dev/null 2>&1; then
  RG_ARGS=(--no-heading -n -i --max-columns 200 --max-columns-preview)
  for e in "${EXTS[@]}"; do RG_ARGS+=(-g "*.$e"); done
  for d in "${SKIP_DIRS[@]}"; do RG_ARGS+=(-g "!**/$d/**"); done
  RG_ARGS+=(-g '!*.min.*' -g '!*.map' -g '!*lock*')
  hits() { rg "${RG_ARGS[@]}" -e "$1" . 2>/dev/null; }
else
  GREP_ARGS=(-rIniE)
  for e in "${EXTS[@]}"; do GREP_ARGS+=(--include="*.$e"); done
  for d in "${SKIP_DIRS[@]}"; do GREP_ARGS+=(--exclude-dir="$d"); done
  GREP_ARGS+=(--exclude='*.min.*' --exclude='*.map' --exclude='*lock*')
  hits() { grep "${GREP_ARGS[@]}" -e "$1" . 2>/dev/null | cut -c1-200; }
fi

check() {
  local id="$1" title="$2" pattern="$3" out n
  out="$(hits "$pattern")"
  if [ -n "$out" ]; then
    n=$(printf '%s\n' "$out" | wc -l | tr -d ' ')
    printf '\n[%s] %s — APLICA (%s coincidencias)\n' "$id" "$title" "$n"
    printf '%s\n' "$out" | head -n "$MAX" | sed 's/^/    /'
  else
    printf '\n[%s] %s — no detectado\n' "$id" "$title"
  fi
}

echo "blindaje-legal · detección en $(pwd)"

check 0 "Registro público de usuarios (contexto para 1, 4, 9)" \
  "auth\.signUp|signUpWith|createUserWithEmail|['\"\`]/(signup|sign-up|register)['\"\`/?]"

check 1 "Edad en el registro (COPPA)" \
  'birth_?date|date_?of_?birth|\bdob\b|age_?gate|tagForChildDirectedTreatment|over_?13|min_?age|isAdult'

check 2 "Fuentes y CDNs de terceros" \
  'fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|kit\.fontawesome\.com|use\.fontawesome\.com|unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|ajax\.googleapis\.com|code\.jquery\.com|gravatar|youtube\.com/embed|youtu\.be|player\.vimeo\.com|maps\.googleapis\.com|google\.com/maps/embed|react-google-maps|google\.com/recaptcha|api\.web3forms\.com|formspree|getform\.io|basin\.'

check 3 "Grabación de sesiones" \
  'posthog|replayIntegration|replaysSessionSampleRate|logrocket|hotjar|clarity\.ms|@microsoft/clarity|fullstory|_fs_capture_on_startup|@openreplay|mouseflow|smartlook|inspectlet|luckyorange|contentsquare'

check 4 "Emails de marketing" \
  "from ['\"]resend['\"]|@sendgrid/mail|mailchimp|postmark|nodemailer|client-ses|mailgun|brevo|sib-api-v3|customerio|loops\.so|@react-email|newsletter|marketing_opt_in|List-Unsubscribe"

check 5 "Suscripciones / renovación automática" \
  "mode: *['\"]subscription|subscriptions\.(create|update)|trial_period_days|billingPortal|@paddle/|lemonsqueezy|chargebee|recurly|revenuecat|react-native-iap|StoreKit|cancel_at_period_end"

check 6 "Contenido subido por usuarios (DMCA)" \
  'multer|busboy|uploadthing|cloudinary|createSignedUploadUrl|storage\.from\(|PutObjectCommand|type=.file.'

check 7 "Cookies, consentimiento, CCPA/GPC" \
  'googletagmanager\.com|google-analytics\.com|react-ga4|@next/third-parties|@vercel/analytics|cloudflareinsights|plausible|umami|mixpanel|amplitude|segment\.(com|io)|@segment/|localStorage\.setItem|gtag\(|GTM-|fbq\(|connect\.facebook\.net|ttq\.|snap\.licdn\.com|criteo|adroll|cookieconsent|cookiebot|onetrust|iubenda|klaro|globalPrivacyControl|sec-gpc|Do Not Sell|Your Privacy Choices|document\.cookie'

check 8 "Accesibilidad (overlays y bloqueos)" \
  'acsbapp|accessibe|userway|audioeye|equalweb|user-scalable *= *no|maximum-scale *= *1|onPaste=|outline: *(none|0)\b|outline-none'

check 9a "Política de privacidad y términos" \
  'privacy-?policy|/privacy|privacidad|terms-of-(service|use)|/terms|terminos|PrivacyInfo'

check 9b "Borrado de cuenta (apps en tiendas)" \
  'delete-?account|deleteUser|eliminar cuenta|deleteAccount'

check 11 "Perú (Ley 29733, Libro de Reclamaciones, IGV)" \
  "https?://[a-z0-9.-]+\\.pe\\b|\\bIGV\\b|[ >\"'(]S/ ?[0-9]+[.,]|wa\\.me/51|Lima, Per|libro de reclamaciones"

check 10 "Reseñas y dark patterns" \
  'testimonial|aggregateRating|randomuser\.me|pravatar|rating: *5\b|countdown|(checked|defaultChecked).{0,80}(marketing|newsletter|consent|terms)'

echo
echo "Señales de plataforma:"
for f in ios android app.json app.config.ts app.config.js capacitor.config.ts capacitor.config.json pubspec.yaml; do
  [ -e "$f" ] && echo "    app móvil: $f"
done
[ -f package.json ] && grep -oE '"(next|vite|react|vue|svelte|astro|nuxt|@sveltejs/kit|expo)"' package.json | sort -u | sed 's/^/    stack: /'
echo
echo "«no detectado» en 9a con datos personales (0, 4, 7, <form>) = falta la política."
echo "Descartar lo que no se sirve al usuario (scripts/, reports/) y countdowns que no son ofertas. Leer lo señalado antes de concluir."
