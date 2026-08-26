# Estructura del proyecto

```
GHL MCP/
│
├── .env.example          # Plantilla de credenciales (subir a GitHub)
├── .env                  # Tus secretos (NO subir)
├── .mcp.json             # Config MCP para Cursor (sin secretos)
├── CLAUDE.md             # Reglas rápidas para agentes IA
├── README.md             # Inicio rápido
│
├── docs/                 # Documentación
│   ├── agent-guide.md    # Guía completa del agente
│   ├── setup.md          # Setup en máquina nueva
│   ├── manual-conexion.md
│   └── STRUCTURE.md      # Este archivo
│
├── lib/                  # Código compartido
│   ├── env.mjs           # Carga .env raíz
│   └── ghl-auth.mjs      # Auth Firebase para workflows
│
├── scripts/              # Scripts ejecutables
│   ├── mcp/
│   │   ├── public.mjs    # Lanza MCP API pública
│   │   └── workflows.mjs # Lanza MCP workflows
│   ├── workflows/
│   │   ├── list.mjs      # Listar automatizaciones
│   │   ├── summarize.mjs # Resumen con triggers/pasos
│   │   └── read-instagram.mjs
│   ├── verify-connection.mjs  # Prueba completa
│   └── migrate-env.mjs        # Migrar credenciales legacy
│
├── mcp/                  # Servidores MCP propios
│   └── workflows/
│       ├── server.js     # MCP workflows CRUD
│       └── package.json
│
├── reference/            # Documentación técnica (no runtime)
│   └── workflows/
│       ├── docs/         # API interna de GHL
│       ├── schemas/      # Tipos de triggers/acciones
│       └── verified/     # Type strings confirmados
│
└── tools/                # Herramientas auxiliares
    ├── api-client/       # SDK fallback + OAuth + webhooks local
    ├── auth-bridge/      # Re-extraer refresh token (emergencia)
    ├── workflow-extractor/  # Extensión Chrome
    └── webhook-worker/   # Webhooks Cloudflare (producción)
```

## Qué usar según la tarea

| Necesitas | Dónde |
|---|---|
| Operar GHL desde Cursor | `.mcp.json` + `.env` |
| Listar workflows | `node scripts/workflows/list.mjs` |
| Probar todo | `node scripts/verify-connection.mjs` |
| API directa / reportes | `tools/api-client/ghl-client.js` |
| Token Firebase revocado | `tools/auth-bridge/` |
| Leer workflow de la UI | `tools/workflow-extractor/` |
| Webhooks en vivo | `tools/webhook-worker/` (requiere deploy) |
| Construir workflow por API | `reference/workflows/schemas/` |

## Instalación mínima

```bash
npm install --prefix mcp/workflows
copy .env.example .env
# editar .env
node scripts/verify-connection.mjs
```
