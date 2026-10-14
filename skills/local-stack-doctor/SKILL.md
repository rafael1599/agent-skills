---
name: local-stack-doctor
description: >
  Auditor del stack local de desarrollo (Docker containers, puertos, procesos,
  imágenes, drift). Previene el patrón "container con build viejo competiendo
  con el dev runtime en host port" que causa bugs intermitentes imposibles de
  debuggear vía logs. Cada proyecto declara su stack canónico en
  `.local-stack.json` y la skill provee `pnpm doctor` (o equivalente) +
  doc canónica + reglas de gating en docker-compose.
  Triggers: "audit docker", "auditá el stack", "pnpm doctor", "/local-stack-doctor",
  "no quiero zombies", "porque hay dos listeners", "container conflict",
  "previene esto en el futuro", "agrega doctor a este proyecto".
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# local-stack-doctor

Skill para diagnosticar y prevenir conflictos en el stack local de desarrollo. Nació de un incidente real (un container `api` con build viejo seguía corriendo en host `:3000` paralelo al dev runtime PM2; el kernel de Windows ruteaba requests al azar entre ambos listeners → query Drizzle del login fallaba con `column "company_id" does not exist` solo a veces, sobreviviendo cada `pm2 restart`).

El patrón es genérico: **cualquier proyecto que tenga un `docker-compose.yml` con un servicio que también puede correr en el host como dev runtime es vulnerable**. La skill:

1. Audita el estado actual (containers, ports, images, processes, drift).
2. Establece reglas durables en docker-compose (profile gating).
3. Wirea un comando de doctor (`pnpm doctor` / `make doctor`) que cualquiera puede correr.
4. Documenta el stack canónico en `docs/local-stack.md` para referencia futura.

> Mira **dentro** de un proyecto (puertos, drift, containers zombis del propio
> stack). No baja los stacks de otros proyectos que compiten por la misma máquina.

---

## Cuándo activarse

- Usuario pide "audit docker", "audita el stack", "previene zombies de container".
- Usuario reporta bugs intermitentes con sospecha de duplicate listeners (frases tipo "porqué hay dos listeners en :3000", "no encuentra usuarios de a ratos", "el query parece de hace meses").
- Usuario pide agregar `pnpm doctor` o equivalent a un proyecto nuevo.
- Después de un incident donde un container competió con un dev runtime — para post-mortem hardening.

---

## Workflow

### 1. Discovery — entender el stack del proyecto actual

Antes de proponer cambios, mapear:

1. ¿Hay `docker-compose.yml`? ¿Qué servicios declara y qué puertos?
2. ¿Qué containers están running? ¿Coinciden con docker-compose o hay drift?
3. ¿El dev runtime corre en host o en container? Si ambos están posibles, ¿hay collisiones? (`netstat -ano` en Windows, `lsof -iTCP -sTCP:LISTEN -P` en macOS/Linux).
4. ¿Hay PM2 configurado? ¿Qué procesos? ¿Hay legacy wrappers que leak grandchildren?
5. ¿Hay un script de doctor / health-check existente?

Comandos típicos de discovery:

```
docker ps --format "{{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}"
docker ps -a --format "{{.Names}}\t{{.Image}}\t{{.Status}}"   # incluye exited
docker images --format "{{.Repository}}:{{.Tag}}\t{{.CreatedSince}}\t{{.Size}}"
docker volume ls
docker network ls
netstat -ano | grep LISTENING                                  # Windows
lsof -iTCP -sTCP:LISTEN -P                                     # macOS/Linux
```

### 2. Audit — output diagnóstico al usuario

Reportar con secciones claras:

- **Containers running** vs **expected** (de docker-compose).
- **Imágenes locales** sospechosas (>14d antiguas, especialmente las que builden el dev API).
- **Puertos colisionados**: cualquier puerto con N>1 listeners → flag inmediato (es el patrón del bug).
- **Drift docker-compose vs runtime**: declared `image:` en yaml vs imagen efectiva del container.
- **PM2 legacy**: cualquier wrapper combinado tipo `concurrently` que leak grandchildren en restart.
- **Containers/volumes/networks zombie**: artefactos de proyectos viejos.

Output debe ser tabular y específico (PIDs, nombres exactos, comandos curativos).

### 3. Cleanup — eliminar artefactos seguros

Categorizar antes de borrar:

- ✅ **Safe**: containers exited, networks sin conexiones activas, imágenes huérfanas builddas localmente que no están en uso.
- ⚠️ **Pedir confirmación**: imágenes pulled de registry (rebuildables pero descarga); volumes de proyectos legacy (puede tener data preciada).
- ❌ **Nunca tocar sin approval**: volumes en uso por containers running, imagenes/containers de proyectos activos.

Comandos típicos:

```
docker rm <container>                # exited
docker rmi <image>                   # imagen huérfana
docker network rm <network>          # network sin conexiones
docker compose down                  # stack del proyecto actual
```

NO ejecutar `docker system prune -a` sin approval explícito — borra todo lo dangling globalmente.

### 4. Hardening — instalar prevención durable

Aplicar al proyecto:

#### a. Config canónica `.local-stack.json`

Crear en la raíz del proyecto:

```json
{
  "ports": {
    "3000": { "owner": "my-app-api (PM2 / tsx watch)", "kind": "host-process" },
    "5432": { "owner": "postgres (Docker my-app-postgres-1)", "kind": "docker" }
  },
  "expectedContainers": ["my-app-postgres-1", "my-app-redis-1"],
  "forbiddenContainers": ["my-app-api-1"],
  "expectedPm2": ["my-app-api", "my-app-admin"],
  "legacyPm2": ["my-app-dev"],
  "imageDriftCheck": true,
  "staleImageDays": 14,
  "staleImagePatterns": ["my-app", "agent-pr"]
}
```

#### b. Doctor script

Copiar `${CLAUDE_SKILL_DIR}/templates/dev-doctor.mjs` a `scripts/dev-doctor.mjs` del proyecto. Es config-driven — lee `.local-stack.json` y reporta. Wire en `package.json`:

```json
"scripts": {
  "doctor": "node scripts/dev-doctor.mjs"
}
```

(Para proyectos non-Node, adaptar — el script mismo es Node pero la lógica se puede portar a Python/Bash.)

#### c. Docker-compose profile gating

Para cualquier servicio en `docker-compose.yml` que **también puede correr en host** (dev runtime, admin UIs, etc.), aplicar:

```yaml
services:
  my-api:
    profiles: ["containerized-api"]  # NOT in default
    build: ...
    ports: ...
```

Documentar en comentario:
- POR QUÉ está gated (one-line referencia al riesgo).
- CÓMO levantarlo cuando se necesita: `docker compose --profile containerized-api up -d`.

#### d. Doc canónica `docs/local-stack.md`

Copiar desde `templates/local-stack.md.template`, llenar con valores del proyecto. Secciones:
- Port allocation table
- Boot sequence
- Por qué existe el profile gate (con link al incident original)
- Diagnostic command (cómo correr el doctor)
- Cleanup playbook
- Reglas para agregar nuevos servicios

#### e. CLAUDE.md pointer

Agregar al `CLAUDE.md` del proyecto un párrafo corto:

```markdown
### Local stack health

Run `pnpm doctor` to audit ports, containers, images, and process state.
See `docs/local-stack.md` for the canonical reference.
```

### 5. Verify — correr el doctor y confirmar todo verde

Antes de cerrar:

1. `pnpm doctor` (o equivalente) → todo verde.
2. `docker compose up -d` y verificar que solo levanta lo esperado (no el servicio gated).
3. Re-correr el doctor — debe seguir verde.

---

## Templates incluidos

- `templates/dev-doctor.mjs` — script genérico, config-driven via `.local-stack.json`.
- `templates/local-stack.json.example` — config de ejemplo con todos los campos documentados.
- `templates/local-stack.md.template` — markdown canónico con placeholders `{{PROJECT_NAME}}` etc.
- `templates/docker-compose-profile-snippet.yml` — patrón YAML para gatear un servicio.

---

## Qué NO hacer

- **NO ejecutar `docker system prune -a` sin approval** — destroy data y caches útiles globalmente.
- **NO borrar volumes sin confirmación**: volume puede tener data preciada del proyecto (postgres data, persistent state). Listar y preguntar.
- **NO matar procesos arbitrariamente** sin identificar quién es: `tasklist /FI` (Windows), `ps aux | grep` (Unix). Killing al vuelo causó loops en el incident original.
- **NO modificar docker-compose sin entender consumers**: CI workflows, agentes de validación (e.g. `stack-validator`), scripts de bring-up. Si gateás un servicio detrás de profile, advertir consumers que necesitan `--profile <name>`.
- **NO asumir que el bug es PM2 sin antes auditar Docker**: el fail-mode más común es un container compitiendo con el dev runtime, NO orphans de PM2.
