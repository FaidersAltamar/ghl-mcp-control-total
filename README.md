# GHL MCP Control Total

Conecta **Cursor** con [GoHighLevel](https://www.gohighlevel.com): contactos, ventas, calendarios, pagos y **workflows completos** desde el chat.

```
Cursor  →  .mcp.json  →  scripts/mcp/  →  .env  →  GoHighLevel
```

---

## Inicio rápido

```bash
git clone https://github.com/FaidersAltamar/ghl-mcp-control-total.git
cd ghl-mcp-control-total

copy .env.example .env          # completar credenciales
npm install --prefix mcp/workflows

node scripts/verify-connection.mjs
```

Reinicia Cursor — `.mcp.json` ya apunta a los servidores MCP.

---

## Estructura

| Carpeta | Qué es |
|---|---|
| [`docs/`](docs/) | Documentación |
| [`lib/`](lib/) | Código compartido (env, auth) |
| [`scripts/`](scripts/) | Scripts ejecutables |
| [`mcp/workflows/`](mcp/workflows/) | Servidor MCP de workflows |
| [`reference/workflows/`](reference/workflows/) | Docs técnicos API interna |
| [`tools/`](tools/) | API fallback, auth-bridge, extractor, webhooks |

Mapa completo → [`docs/STRUCTURE.md`](docs/STRUCTURE.md)

---

## Comandos útiles

```bash
node scripts/verify-connection.mjs   # prueba API + workflows
node scripts/workflows/list.mjs      # listar automatizaciones
node scripts/workflows/summarize.mjs # detalle triggers/pasos
```

---

## MCP Tools

**API pública (`ghl`)** — 127 tools: contactos, ventas, calendarios, pagos…

**Workflows (`ghl-workflow-builder`)** — `ghl_list_workflows`, `ghl_create_workflow`, `ghl_add_trigger`, `ghl_add_action`, `ghl_publish_workflow`, `ghl_delete_workflow`

---

## Credenciales

Un solo archivo: **`.env`** en la raíz. Plantilla: `.env.example`. Nunca subir `.env` a GitHub.

| Variable | Para qué |
|---|---|
| `GHL_PIT_TOKEN` | API pública |
| `GHL_FIREBASE_REFRESH_TOKEN` | Workflows |
| `GHL_LOCATION_ID` | Sub-cuenta GHL |

---

## Documentación

- [Setup máquina nueva](docs/setup.md)
- [Guía agente IA](docs/agent-guide.md)
- [Manual conexión GHL](docs/manual-conexion.md)

---

**Faiders Altamar** — Control Ads
