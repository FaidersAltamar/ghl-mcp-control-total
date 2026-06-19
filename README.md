# GHL MCP Control Total

Integración completa de OpenCode / Claude Code con GoHighLevel (GHL) para tener control total sobre la location `Control Ads` (`kNcygEmVTrhIueZQMDXM`).

Combina:
- **MCP server público** de GHL para contactos, ventas, calendarios, etc.
- **MCP server propio** para crear, editar y publicar workflows/automatizaciones.
- **API directa** como fallback.
- **Extensión de Chrome** para extraer workflows desde la UI de GHL.

---

## 🚀 Qué puedes hacer

Desde el chat de OpenCode o Claude Code puedes pedir:

> *"Crea un workflow de Instagram que responda 'hola como estás' cuando alguien escriba MCP"*

> *"Muéstrame todas mis automatizaciones activas"*

> *"Cuánto he vendido este mes y qué productos se vendieron"*

> *"Lista mis contactos que compraron el curso SUDO"*

> *"Publica el workflow de Instagram - Dropi"*

---

## 📁 Estructura

```
.
├── CLAUDE.md                       # Guía completa para el agente
├── README.md                       # Este archivo
├── .mcp.json                       # Config local de MCP (no se sube a Git)
├── .opencode/mcp.json              # Config de OpenCode (no se sube a Git)
│
├── api-client/                     # Scripts de fallback con el SDK oficial
│   ├── ghl-client.js               # Wrapper genérico del SDK
│   ├── webhook-server.js           # Receptor de webhooks
│   ├── oauth-helper.js             # Helper OAuth
│   └── ...
│
├── ghl-workflow-builder/           # Control total de workflows
│   ├── mcp-server/
│   │   ├── server.js               # MCP server de workflows
│   │   ├── package.json
│   │   └── .env.example            # Ejemplo de variables
│   ├── docs/                       # Documentación de la API interna
│   ├── schemas/                    # Schemas de triggers y acciones
│   └── scripts/
│
└── ghl-workflow-extractor/         # Extensión Chrome para extraer workflows
    ├── manifest.json
    ├── content-opencode.js
    ├── console-extractor-v2.js
    ├── server.js
    └── README-OPENCODE.md
```

---

## ⚙️ Configuración rápida

### 1. Clonar e instalar

```bash
git clone https://github.com/FaidersAltamar/ghl-mcp-control-total.git
cd ghl-mcp-control-total

# Instalar dependencias del workflow builder MCP
cd ghl-workflow-builder/mcp-server
npm install
```

### 2. Configurar credenciales

Crear `ghl-workflow-builder/mcp-server/.env`:

```env
GHL_FIREBASE_REFRESH_TOKEN=tu_refresh_token_de_firebase
GHL_DEFAULT_LOCATION_ID=kNcygEmVTrhIueZQMDXM
```

> El refresh token se extrae de GHL: DevTools → Application → IndexedDB → `firebaseLocalStorageDb`.

Crear `.mcp.json` en la raíz:

```json
{
  "mcpServers": {
    "ghl": {
      "command": "npx",
      "args": ["-y", "@nerdsnipe-inc/ghl-mcp-server"],
      "env": {
        "GHL_PIT_TOKEN": "tu_pit_token",
        "GHL_LOCATION": "kNcygEmVTrhIueZQMDXM"
      }
    },
    "ghl-workflow-builder": {
      "command": "node",
      "args": ["ghl-workflow-builder/mcp-server/server.js"],
      "env": {
        "GHL_FIREBASE_REFRESH_TOKEN": "tu_refresh_token_de_firebase",
        "GHL_DEFAULT_LOCATION_ID": "kNcygEmVTrhIueZQMDXM"
      }
    }
  }
}
```

### 3. Reiniciar OpenCode / Claude Code

Para que cargue los nuevos MCP servers.

---

## 🛠️ Tools disponibles

### MCP público de GHL (`ghl_*`)
127 tools para contactos, conversaciones, calendarios, oportunidades, pagos, etc.

### MCP propio de workflows (`ghl_*` en `ghl-workflow-builder`)
- `ghl_list_workflows`
- `ghl_get_workflow`
- `ghl_create_workflow`
- `ghl_add_trigger`
- `ghl_add_action`
- `ghl_publish_workflow`
- `ghl_delete_workflow`

---

## 🔒 Seguridad

- **Nunca subas tokens a GitHub.** Los archivos con credenciales están en `.gitignore`.
- El refresh token de Firebase expira la sesión si la contraseña cambia.
- El PIT token solo funciona para la location configurada.

---

## ⚠️ Limitaciones conocidas

| Funcionalidad | Estado | Nota |
|---|---|---|
| Workflows | ✅ Control total | Crear, editar, publicar, borrar |
| Contactos | ✅ Completo | Via MCP público |
| Ventas / oportunidades | ✅ Completo | Via MCP público + API directa |
| Calendarios / citas | ✅ Completo | Via MCP público |
| Cursos / memberships | ❌ No disponible | GHL no expone API pública |
| Webhooks en tiempo real | ❌ Requiere pasos extra | Necesita Marketplace OAuth app |
| Nivel agencia / multi-location | ❌ No disponible | Requiere token de agencia |

---

## 📚 Documentación adicional

- `CLAUDE.md` — guía completa para el agente
- `ghl-workflow-builder/docs/` — API interna de workflows
- `ghl-workflow-extractor/README-OPENCODE.md` — cómo usar la extensión Chrome

---

## 🧑‍💻 Autor

Faiders Altamar — Control Ads
