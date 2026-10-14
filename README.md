# agent-skills

Skills públicas para agentes de código (Claude Code, Codex, Cursor, Gemini CLI y los demás
que leen `SKILL.md`). Escritas en español.

| Skill | Para qué |
|---|---|
| [`blindaje-legal`](skills/blindaje-legal) | Audita una web o app y arregla riesgos legales: COPPA, Google Fonts/GDPR, grabación de sesiones, CAN-SPAM, suscripciones, DMCA, cookies, CCPA/GPC, WCAG 2.2, políticas, reseñas falsas, Perú. |
| [`cdp-ui-check`](skills/cdp-ui-check) | Captura y ejercita una UI local con Chrome headless por CDP, sin extensión. |
| [`image-cors-cache-bust`](skills/image-cors-cache-bust) | Imágenes cross-origin que fallan en canvas/PDF aunque el bucket tenga CORS. |
| [`tareas-largas`](skills/tareas-largas) | Lanzar y vigilar comandos largos en segundo plano sin reportar progreso falso. |
| [`perf-testing`](skills/perf-testing) | Medir primero, optimizar la capa que señala la evidencia, volver a medir (k6). |
| [`local-stack-doctor`](skills/local-stack-doctor) | Auditor del stack local: puertos, contenedores zombis, drift de imágenes. |

## Instalar

Cualquier agente, con el CLI de [skills.sh](https://skills.sh):

```bash
npx skills add rafael1599/agent-skills                        # elegir
npx skills add rafael1599/agent-skills --skill blindaje-legal  # una
```

Claude Code, como plugin (se invocan como `/rafa:<skill>`):

```bash
claude plugin marketplace add rafael1599/agent-skills
claude plugin install rafa@rafa-skills
```

## Cómo se mantiene

Este repo es **la única fuente** de estas skills: no son copia de otro repo. Una skill nueva
entra aquí sólo si no contiene nada privado (rutas, servidores, datos de clientes, proyectos).

Las skills que razonan sobre leyes citan fuentes primarias con la fecha de consulta; lo
marcado ⚠️ no se pudo leer en fuente primaria. No es asesoría legal.

Licencia: MIT.
