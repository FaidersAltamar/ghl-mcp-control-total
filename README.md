# GHL MCP Control Total

**Control total de GoHighLevel desde Cursor, Claude Code u OpenCode** — contactos, ventas, calendarios, pagos, conversaciones y **workflows completos** (crear, editar, publicar, borrar) hablando con la IA en lenguaje natural.

Parte del ecosistema digital de **[Faiders Altamar](https://www.faidersaltamar.com/)** · Comunidad **[RUSH — Escuela de Ventas Prohibida](https://www.skool.com/rush)**

[![GitHub](https://img.shields.io/github/stars/FaidersAltamar/ghl-mcp-control-total?style=social)](https://github.com/FaidersAltamar/ghl-mcp-control-total)
![MCP Tools](https://img.shields.io/badge/MCP_tools-127+-blue)
![Workflows CRUD](https://img.shields.io/badge/Workflows-CRUD_completo-green)
![Node](https://img.shields.io/badge/Node-18+-339933)

---

## Qué es esto

Este repositorio conecta tu cuenta de **[GoHighLevel (GHL)](https://www.gohighlevel.com)** con agentes de IA mediante **MCP (Model Context Protocol)**. En lugar de entrar a la UI de GHL para cada tarea, le pides al chat:

> *"Lista mis contactos que compraron este mes"*  
> *"Cuánto vendí en el curso SUDO y qué producto se vendió más"*  
> *"Crea un workflow de Instagram que responda cuando escriban DROPi"*  
> *"Publica el workflow de carritos abandonados"*  
> *"Muéstrame todas las automatizaciones activas con sus triggers"*

La IA ejecuta las operaciones en tu sub-cuenta GHL en tiempo real.

### Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  Cursor / Claude Code / OpenCode                            │
└──────────────────────────┬──────────────────────────────────┘
                           │ MCP (stdio)
              ┌────────────┴────────────┐
              ▼                         ▼
     ┌─────────────────┐      ┌──────────────────────┐
     │  ghl            │      │  ghl-workflow-builder │
     │  (API pública)  │      │  (API interna)        │
     │  127 tools      │      │  CRUD workflows       │
     │  PIT token      │      │  Firebase refresh     │
     └────────┬────────┘      └──────────┬───────────┘
              │                          │
              └────────────┬─────────────┘
                           ▼
              ┌────────────────────────┐
              │  GoHighLevel             │
              │  services.leadconnector… │
              │  backend.leadconnector…  │
              └────────────────────────┘
                           ▲
              ┌────────────┴─────────────┐
              │  .env (raíz)             │
              │  credenciales únicas     │
              └──────────────────────────┘
```

---

## Qué incluye el repositorio

| Componente | Ruta | Para qué sirve |
|---|---|---|
| **MCP API pública** | `scripts/mcp/public.mjs` | 127 herramientas: CRM, ventas, calendarios, pagos, email, social… |
| **MCP Workflows** | `mcp/workflows/server.js` | Crear, editar, publicar y borrar automatizaciones |
| **Verificación** | `scripts/verify-connection.mjs` | 23 checks automáticos (API + Firebase + SDK) |
| **Scripts workflows** | `scripts/workflows/` | Listar, resumir e inspeccionar automatizaciones |
| **SDK fallback** | `tools/api-client/` | Llamadas directas cuando MCP no alcanza |
| **Auth bridge** | `tools/auth-bridge/` | Re-extraer refresh token si expira la sesión |
| **Extractor Chrome** | `tools/workflow-extractor/` | Leer workflows hechos a mano en la UI de GHL |
| **Webhooks prod** | `tools/webhook-worker/` | Receptor Cloudflare para eventos en tiempo real |
| **Referencia API** | `reference/workflows/` | Schemas, type strings y docs de la API interna |
| **Documentación** | `docs/` | Guías de setup, conexión y agente IA |

---

## Capacidades verificadas

Probado en la location **Control Ads** (Cali, CO · timezone `America/Bogota`):

| Área | Estado | Detalle |
|---|---|---|
| Contactos & búsqueda avanzada | ✅ | Listado, search POST, tags, custom fields |
| Usuarios & equipos | ✅ | `/users/` y `/users/search` |
| Calendarios & citas | ✅ | 14 calendarios activos |
| Pipelines & oportunidades | ✅ | Pipelines, búsqueda avanzada |
| Productos & catálogo | ✅ | Productos, inventario |
| Pagos | ✅ | Órdenes, transacciones, suscripciones |
| Redes sociales | ✅ | Cuentas conectadas, posting |
| Workflows (lista pública) | ✅ | Metadata via API pública |
| **Workflows CRUD interno** | ✅ | 18 workflows · 8 activos · triggers + pasos |
| Conversaciones & mensajes | ✅ | Via MCP `ghl_send_message`, etc. |
| Subida de archivos | ✅ | `POST /medias/upload-file` |
| Webhooks tiempo real | ⚠️ | Listo en `tools/webhook-worker/` — requiere deploy + OAuth app |
| Cursos / memberships | ❌ | GHL no expone API pública de lectura |
| Multi-location (agencia) | ❌ | Requiere token de agencia |

---

## MCP Tools disponibles

### Servidor `ghl` — API pública (127 tools)

Paquete [`@nerdsnipe-inc/ghl-mcp-server`](https://www.npmjs.com/package/@nerdsnipe-inc/ghl-mcp-server):

| Categoría | Ejemplos de tools |
|---|---|
| **Contactos** | `ghl_get_contacts`, `ghl_create_contact`, `ghl_search_contacts`, tags, notas, tareas |
| **Conversaciones** | `ghl_search_conversations`, `ghl_send_message`, `ghl_send_email` |
| **Calendarios** | `ghl_get_calendars`, `ghl_create_appointment`, free slots |
| **Oportunidades** | `ghl_search_opportunities`, pipelines, crear/actualizar deals |
| **Pagos** | órdenes, transacciones, suscripciones, cupones, facturas |
| **Funnels & forms** | funnels, formularios, encuestas |
| **Email & social** | templates, campañas, cuentas sociales, posts |
| **Location** | tags, custom fields, custom values, usuarios |
| **Knowledge base** | FAQs, crawler, entrenamiento |

### Servidor `ghl-workflow-builder` — Automatizaciones

Servidor propio sobre la API interna de GHL (`backend.leadconnectorhq.com`):

| Tool | Acción |
|---|---|
| `ghl_list_workflows` | Listar todas las automatizaciones |
| `ghl_get_workflow` | Detalle completo + triggers + pasos |
| `ghl_create_workflow` | Crear workflow vacío |
| `ghl_add_trigger` | Agregar trigger (Instagram, tag, formulario…) |
| `ghl_add_action` | Agregar pasos (email, SMS, wait, tag, etc.) |
| `ghl_publish_workflow` | Activar / publicar |
| `ghl_delete_workflow` | Eliminar |

---

## Inicio rápido

### Requisitos

- **Node.js 18+**
- Cuenta **GoHighLevel** con sub-cuenta activa
- **Cursor** (o Claude Code / OpenCode) con soporte MCP
- Token **PIT** (Private Integration Token) con todos los scopes
- **Refresh token Firebase** (para workflows) — ver [auth-bridge](tools/auth-bridge/README.md)

### 1. Clonar e instalar

```bash
git clone https://github.com/FaidersAltamar/ghl-mcp-control-total.git
cd ghl-mcp-control-total

npm install --prefix mcp/workflows
npm install --prefix tools/api-client   # opcional
```

### 2. Configurar credenciales

```bash
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux
```

Edita `.env` con tus valores:

| Variable | Dónde obtenerla |
|---|---|
| `GHL_PIT_TOKEN` | GHL → Settings → Integrations → **Private Integrations** |
| `GHL_FIREBASE_REFRESH_TOKEN` | Chrome DevTools → Application → IndexedDB → `firebaseLocalStorageDb` |
| `GHL_LOCATION_ID` | URL de GHL al entrar a tu sub-cuenta |
| `GHL_COMPANY_ID` | Settings de la agencia (opcional) |

> **Nunca subas `.env` a GitHub.** Ya está en `.gitignore`. Solo `.env.example` va al repo.

### 3. Verificar conexión

```bash
node scripts/verify-connection.mjs
```

Resultado esperado: **23 OK · 0 FAIL**.

```bash
node scripts/workflows/list.mjs       # listar automatizaciones
node scripts/workflows/summarize.mjs  # detalle con triggers y pasos
```

### 4. Conectar en Cursor

El archivo `.mcp.json` ya está configurado **sin secretos**:

```json
{
  "mcpServers": {
    "ghl": {
      "command": "node",
      "args": ["scripts/mcp/public.mjs"]
    },
    "ghl-workflow-builder": {
      "command": "node",
      "args": ["scripts/mcp/workflows.mjs"]
    }
  }
}
```

**Reinicia Cursor** para cargar los servidores MCP. Luego prueba en el chat:

> *"Lista mis contactos"* · *"Cuántos workflows activos tengo?"*

---

## Estructura del proyecto

```
GHL MCP/
├── .env.example              ← plantilla de credenciales
├── .mcp.json                 ← config MCP (sin secretos)
├── README.md
├── CLAUDE.md                 ← reglas rápidas para agentes IA
│
├── docs/                     ← documentación
│   ├── agent-guide.md        ← guía completa (127 tools, endpoints)
│   ├── setup.md              ← setup en máquina nueva
│   ├── manual-conexion.md    ← PIT, OAuth, webhooks
│   └── STRUCTURE.md          ← mapa detallado
│
├── lib/                      ← código compartido
│   ├── env.mjs               ← carga .env raíz
│   └── ghl-auth.mjs          ← auth Firebase
│
├── scripts/
│   ├── mcp/                  ← launchers MCP
│   ├── workflows/            ← list, summarize, read-instagram
│   ├── verify-connection.mjs
│   └── migrate-env.mjs
│
├── mcp/workflows/            ← servidor MCP workflows
├── reference/workflows/      ← docs API interna + schemas
└── tools/
    ├── api-client/           ← SDK oficial + OAuth + webhooks local
    ├── auth-bridge/          ← re-extraer refresh token
    ├── workflow-extractor/   ← extensión Chrome
    └── webhook-worker/       ← Cloudflare Worker
```

Mapa completo → [`docs/STRUCTURE.md`](docs/STRUCTURE.md)

---

## Comandos útiles

```bash
# Verificación completa (23 checks)
node scripts/verify-connection.mjs

# Workflows
node scripts/workflows/list.mjs
node scripts/workflows/summarize.mjs
node scripts/workflows/read-instagram.mjs

# API directa (fallback)
node tools/api-client/ghl-client.js raw GET /contacts/ '{"locationId":"TU_ID","limit":5}'

# Migrar credenciales de instalación antigua
node scripts/migrate-env.mjs
```

### PowerShell — probar PIT manualmente

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') { Set-Item "env:$($matches[1].Trim())" $matches[2].Trim() }
}
curl.exe -s -H "Authorization: Bearer $env:GHL_PIT_TOKEN" -H "Version: 2021-07-28" `
  "https://services.leadconnectorhq.com/locations/$env:GHL_LOCATION_ID"
```

---

## Herramientas auxiliares (`tools/`)

### `api-client/` — Fallback SDK oficial

Cuando MCP no expone un endpoint o necesitas reportes masivos:

```bash
node tools/api-client/ghl-client.js discover
node tools/api-client/ghl-client.js contacts getContacts '{"locationId":"...","limit":10}'
```

Incluye helpers OAuth (`exchange-oauth-code.mjs`, `refresh-oauth-token.mjs`) y receptor local de webhooks (`webhook-server.js`).

### `auth-bridge/` — Emergencia de token

Si `list.mjs` devuelve **401**, el refresh token de Firebase fue revocado. Sigue [`tools/auth-bridge/README.md`](tools/auth-bridge/README.md) para re-extraerlo desde Chrome.

### `workflow-extractor/` — Extensión Chrome

La API pública solo lista workflows (nombre, estado). Para **leer el árbol completo** de workflows hechos en la UI:

1. Carga la extensión en `chrome://extensions`
2. Abre GHL → Automation → Workflows
3. Usa el botón de extracción → genera `workflows-live.json`

Ver [`tools/workflow-extractor/README-OPENCODE.md`](tools/workflow-extractor/README-OPENCODE.md).

### `webhook-worker/` — Webhooks en producción

Receptor en **Cloudflare Workers** con verificación de firmas Ed25519. Requiere Marketplace OAuth app en GHL.

```bash
cd tools/webhook-worker
npm install
npx wrangler deploy
```

---

## Seguridad

- **Un solo `.env`** en la raíz — fuente única de credenciales
- `.mcp.json` **no contiene tokens** — seguro para GitHub
- El PIT token es scoped a **una location** — no accede a otras sub-cuentas
- El refresh token Firebase se revoca si cierras sesión en GHL o cambias contraseña
- **Nunca** compartas `.env` ni hagas commit de tokens

---

## Limitaciones conocidas

| Funcionalidad | Estado | Alternativa |
|---|---|---|
| Workflows CRUD | ✅ Completo | MCP `ghl-workflow-builder` |
| CRM, ventas, calendarios | ✅ Completo | MCP `ghl` |
| Webhooks push | ⚠️ Requiere setup | `tools/webhook-worker/` + OAuth app |
| Cursos / memberships | ❌ | Sin API pública de lectura |
| Editor de funnels/páginas | ❌ | Solo lectura de metadata |
| Nivel agencia | ❌ | Token de agencia separado |

---

## Documentación

| Archivo | Contenido |
|---|---|
| [docs/agent-guide.md](docs/agent-guide.md) | Guía completa: 127 tools, endpoints, reglas del agente |
| [docs/setup.md](docs/setup.md) | Configurar en una máquina nueva |
| [docs/manual-conexion.md](docs/manual-conexion.md) | PIT, OAuth Marketplace, webhooks paso a paso |
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | Mapa de carpetas y qué usar según la tarea |
| [reference/workflows/schemas/](reference/workflows/schemas/) | Type strings de triggers y acciones |

---

## Casos de uso reales (Control Ads)

Automatizaciones activas gestionadas con este stack:

- Correos de confirmación de compra / carritos abandonados
- DM Instagram — comunidad FAIDERS
- Instagram Comment Automation
- DonBM — baneo, contingencias Meta, cuentas publicitarias
- Respuestas automáticas por keyword en Instagram

Ventas verificadas vía API: **292 transacciones** · producto top **Contingencia SUDO 2025**.

---

## Ecosistema Faiders Altamar

Este proyecto es parte del stack de automatización del ecosistema digital de Faiders Altamar:

| Recurso | Enlace |
|---|---|
| **Sitio web** | [faidersaltamar.com](https://www.faidersaltamar.com/) |
| **Comunidad RUSH** | [skool.com/rush](https://www.skool.com/rush) — Escuela de Ventas Prohibida |
| **GitHub** | [ghl-mcp-control-total](https://github.com/FaidersAltamar/ghl-mcp-control-total) |
| **GoHighLevel** | [gohighlevel.com](https://www.gohighlevel.com) |

**RUSH** es la comunidad gratuita (+380 miembros) para dominar Meta Ads, contingencias, automatización con IA y herramientas del ecosistema — incluyendo integraciones como esta.

En **[faidersaltamar.com](https://www.faidersaltamar.com/)** encuentras formación, servicios de Meta Ads, productos (Blouo, Trulubook, Skooltor, Mijo…) y el roadmap completo para escalar tu negocio digital en LATAM.

---

## Contribuir

1. Fork del repo
2. Crea una rama (`git checkout -b feature/mi-mejora`)
3. **No incluyas `.env`** en commits
4. Prueba con `node scripts/verify-connection.mjs`
5. Abre un Pull Request

---

## Licencia

Uso privado / educativo del ecosistema Faiders Altamar. No redistribuir credenciales ni tokens.

---

<p align="center">
  <strong>Faiders Altamar</strong> · Control Ads · Cali, Colombia<br>
  <a href="https://www.faidersaltamar.com/">faidersaltamar.com</a> ·
  <a href="https://www.skool.com/rush">RUSH en Skool</a> ·
  <a href="https://github.com/FaidersAltamar/ghl-mcp-control-total">GitHub</a>
</p>
