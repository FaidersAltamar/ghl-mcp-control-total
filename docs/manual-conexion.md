# Manual de Conexión con GoHighLevel (GHL)

**Proyecto:** Control Ads (Ubicación: `kNcygEmVTrhIueZQMDXM`)
**Última actualización:** 2024-11-22
**Autor:** Claude Code

---

## 📌 **Índice**
1. [Introducción](#-introducción)
2. [Componentes de la Conexión](#-componentes-de-la-conexión)
   - [1. Token PIT (Private Integration Token)](#1-token-pit-private-integration-token)
   - [2. Marketplace OAuth App](#2-marketplace-oauth-app)
3. [Configuración Inicial](#-configuración-inicial)
   - [Paso 1: Configurar el Token PIT](#paso-1-configurar-el-token-pit)
   - [Paso 2: Configurar la OAuth App](#paso-2-configurar-la-oauth-app)
   - [Paso 3: Verificar la Conexión](#paso-3-verificar-la-conexión)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Endpoints y Herramientas Disponibles](#-endpoints-y-herramientas-disponibles)
6. [Solución de Problemas](#-solución-de-problemas)
7. [Flujo de Trabajo con Webhooks](#-flujo-de-trabajo-con-webhooks)
8. [Buenas Prácticas](#-buenas-prácticas)
9. [Referencias](#-referencias)

---

## 🔍 **Introducción**
Este manual explica cómo funciona la conexión con **GoHighLevel (GHL)** en el proyecto **Control Ads**, incluyendo:
- Los tipos de autenticación utilizados (Token PIT y OAuth).
- Dónde y cómo se configuran las credenciales.
- Cómo verificar que la conexión está activa.
- Solución de problemas comunes.

> **Nota:** Este proyecto usa **dos métodos de autenticación** para interactuar con GHL:
> - **Token PIT**: Para operaciones CRUD en la API pública.
> - **Marketplace OAuth App**: Para webhooks y scopes extendidos.

---

## 🔗 **Componentes de la Conexión**

### **1. Token PIT (Private Integration Token)**
**Propósito:**
- Autenticación principal para la **API pública de GHL** (versión `2021-07-28`).
- Permite operaciones como:
  - Gestión de contactos, workflows, calendarios, pagos, etc.
  - Acceso a endpoints bajo `/locations/{locationId}`.

**Detalles técnicos:**
- **Token:** `your_pit_token_from_.env`
- **Location ID:** `kNcygEmVTrhIueZQMDXM` (*Control Ads*).
- **Scopes requeridos:** Deben estar habilitados en **GHL Settings > Private Integrations** (ej: `contacts.readonly`, `workflows.write`).

**Limitaciones:**
- No permite webhooks.
- No accede a datos de otras ubicaciones (ej: *DropKiller*).
- No cubre endpoints de agencia (ej: `/companies/{id}`).

---

### **2. Marketplace OAuth App**
**Propósito:**
- Registrar **webhooks** (eventos en tiempo real como `ContactCreate`, `InvoicePaid`).
- Acceder a endpoints que el **PIT no cubre** (ej: cursos, datos de agencia).

**Detalles técnicos:**
- **Tipo:** *Private App* (creada en [GHL Marketplace](https://marketplace.gohighlevel.com/)).
- **Scopes:** Todos los disponibles (read + write).
- **Webhook URL:**
  - Producción: `https://ghl-control-ads-webhook-worker.tu-cuenta.workers.dev/webhooks/ghl`
  - Desarrollo: `https://<ngrok-id>.ngrok.io` + `tools/api-client/webhook-server.js`.

**Tokens generados:**
- **Access Token (`at-...`)**: Expira en 24 horas.
- **Refresh Token (`rt-...`)**: Para renovar el access token.

---

## ⚙️ **Configuración Inicial**

### **Paso 1: Configurar el Token PIT**
1. **Generar el token en GHL:**
   - Ve a **Settings > Private Integrations**.
   - Haz clic en **Create Private Integration Token**.
   - Selecciona todos los scopes necesarios (ej: `contacts`, `workflows`, `calendars`).
   - Copia el token generado (ej: `your_pit_token_from_.env`).

2. **Configurar el token en el proyecto:**
   - Archivo: **`.env` en la raíz del proyecto** (copia desde `.env.example`).
     ```env
     GHL_PIT_TOKEN=your_pit_token_here
     GHL_LOCATION_ID=kNcygEmVTrhIueZQMDXM
     ```
   - El `.mcp.json` **no contiene secretos** — los scripts leen `.env` automáticamente.
   - **Nota:** `.env` está en `.gitignore` para evitar exponer el token.

3. **Verificar el token:**
   ```bash
   curl -s "https://services.leadconnectorhq.com/locations/kNcygEmVTrhIueZQMDXM" \
     -H "Authorization: Bearer your_pit_token_from_.env" \
     -H "Version: 2021-07-28"
   ```
   - **Respuesta esperada:** Detalles de la ubicación *Control Ads* (código 200).

---

### **Paso 2: Configurar la OAuth App**
1. **Crear la app en GHL Marketplace:**
   - Ve a [GHL Marketplace](https://marketplace.gohighlevel.com/) > **Create App**.
   - Selecciona **Private App**.
   - Configura los scopes (todos los disponibles).
   - Define la **Webhook URL** (ej: `https://ghl-control-ads-webhook-worker.tu-cuenta.workers.dev/webhooks/ghl`).
   - Guarda la app y copia el **Client ID** y **Client Secret**.

2. **Configurar las credenciales en el proyecto:**
   - Archivo: **`.env` en la raíz** (usa `.env.example` como plantilla).
     ```env
     GHL_OAUTH_CLIENT_ID=tu_client_id
     GHL_OAUTH_CLIENT_SECRET=tu_client_secret
     GHL_WEBHOOK_ADMIN_SECRET=tu_secreto_para_firmas
     ```

3. **Generar tokens de acceso:**
   - Usa el script `tools/api-client/exchange-oauth-code.mjs` para intercambiar un código de autorización por tokens:
     ```bash
     node tools/api-client/exchange-oauth-code.mjs <auth-code>
     ```
   - **Salida esperada:**
     ```json
     {
       "access_token": "at-...",
       "refresh_token": "rt-...",
       "expires_in": 86400
     }
     ```

4. **Verificar los tokens:**
   ```bash
   curl -H "Authorization: Bearer at-..." "https://services.leadconnectorhq.com/contacts/"
   ```
   - **Respuesta esperada:** Lista de contactos (código 200).

---

### **Paso 3: Verificar la Conexión**
1. **Probar los MCP Servers:**
   - Ejecuta el servidor de workflows:
     ```bash
     cd mcp/workflows
     npm install
     node server.js
     ```
   - **Respuesta esperada:** Logs de inicialización sin errores.

2. **Probar los webhooks:**
   - Envía un evento de prueba desde GHL Marketplace (ej: `ContactCreate`).
   - **Respuesta esperada:** Logs en `webhook-worker/` o `tools/api-client/webhooks.log`.

---

## 📁 **Estructura del Proyecto**
```
GHL-MCP/
├── .env.example             # Plantilla de credenciales
├── .env                     # Credenciales reales (gitignored)
├── .mcp.json                # Config MCP (sin secretos)
├── docs/                    # Documentación
├── lib/                     # env.mjs, ghl-auth.mjs
├── scripts/
│   ├── mcp/                 # Launchers MCP
│   ├── workflows/           # list, summarize, read-instagram
│   └── verify-connection.mjs
├── mcp/workflows/           # Servidor MCP workflows (server.js)
├── reference/workflows/     # Docs API interna + schemas
└── tools/
    ├── api-client/          # SDK fallback + OAuth + webhooks local
    ├── auth-bridge/         # Re-extraer refresh token
    ├── workflow-extractor/  # Extensión Chrome
    └── webhook-worker/      # Cloudflare Worker
```

---

## 🛠️ **Endpoints y Herramientas Disponibles**

### **1. MCP Servers**
- **`@nerdsnipe-inc/ghl-mcp-server`**: 127 herramientas para operaciones estándar (ej: `ghl_get_contacts`, `ghl_create_workflow`).
- **`mcp/workflows/server.js`**: CRUD de workflows (ej: `ghl_create_workflow`, `ghl_publish_workflow`).

**Ejemplo de uso:**
```javascript
// Usando el MCP Server
const { ghl_get_contacts } = require('@nerdsnipe-inc/ghl-mcp-server');
const contacts = await ghl_get_contacts({ locationId: 'kNcygEmVTrhIueZQMDXM' });
```

---

### **2. API Directa (Fallback)**
Cuando el MCP falla, se usa `curl` o `ghl-client.js` con el Token PIT o OAuth.

**Ejemplo:**
```bash
curl -s "https://services.leadconnectorhq.com/workflows/" \
  -H "Authorization: Bearer your_pit_token_from_.env" \
  -H "Version: 2021-07-28"
```

---

### **3. Webhooks**
Eventos soportados:
- `ContactCreate`, `ContactUpdate`, `ContactDelete`
- `InvoicePaid`, `AppointmentBooked`
- `WorkflowCompleted`

**Firma de webhooks:**
- **Ed25519**: `X-GHL-Signature` (recomendado).
- **RSA Legacy**: `X-WH-Signature`.

**Ejemplo de procesamiento en `webhook-worker/index.js`:**
```javascript
addEventListener('fetch', (event) => {
  const signature = event.request.headers.get('X-GHL-Signature');
  const secret = process.env.GHL_WEBHOOK_ADMIN_SECRET;
  if (!verifySignature(event.request, signature, secret)) {
    return new Response('Invalid signature', { status: 401 });
  }
  // Procesar el evento...
});
```

---

## 🚨 **Solución de Problemas**

| Problema | Causa | Solución |
|----------|-------|----------|
| `401 Unauthorized` | Token PIT expirado/revocado. | Regenerar el token en GHL y actualizar `.mcp.json` y `.env`. |
| `403 Forbidden` | Scopes insuficientes. | Habilitar todos los scopes en **GHL Settings > Private Integrations**. |
| `429 Too Many Requests` | Límite de tasa (100 req/10s). | Implementar retries con backoff exponencial. |
| Webhooks no llegan | URL incorrecta o firma inválida. | Verificar `GHL_WEBHOOK_ADMIN_SECRET` en Cloudflare Worker o ngrok. |
| MCP no responde | Servidor caído. | Reiniciar OpenCode/Claude o ejecutar el MCP manualmente. |
| `500 Internal Server Error` | Endpoint no disponible. | Revisar logs y probar con `curl` directamente. |

---

## 🔄 **Flujo de Trabajo con Webhooks**
1. **Configuración inicial:**
   - Crear la OAuth App en GHL Marketplace.
   - Configurar la Webhook URL (ej: Cloudflare Worker).

2. **Registro de eventos:**
   - Suscribirse a eventos como `ContactCreate` desde la app en GHL.

3. **Procesamiento:**
   - GHL envía un payload a la Webhook URL cuando ocurre el evento.
   - El Worker verifica la firma y procesa el evento (ej: notificar a Slack, actualizar una base de datos).

4. **Ejemplo de payload:**
   ```json
   {
     "type": "ContactCreate",
     "data": {
       "id": "abc123",
       "firstName": "Juan",
       "email": "juan@example.com"
     }
   }
   ```

---

## ✅ **Buenas Prácticas**
1. **Seguridad:**
   - Nunca expongas tokens en repositorios públicos (usa `.gitignore`).
   - Usa variables de entorno para credenciales.
   - Renueva los tokens OAuth periódicamente.

2. **Manejo de errores:**
   - Implementa retries con backoff exponencial para errores `429`.
   - Loggea todos los errores para diagnóstico.

3. **Webhooks:**
   - Usa HTTPS para la Webhook URL.
   - Verifica siempre las firmas de los eventos.
   - Responde con `200 OK` rápidamente para evitar reintentos.

4. **Testing:**
   - Prueba los endpoints con `curl` antes de integrarlos en el código.
   - Usa `tools/api-client/probe-all-endpoints.js` para verificar la conexión.

---

## 📚 **Referencias**
- [Documentación oficial de GHL API](https://developers.gohighlevel.com/)
- [GHL Marketplace](https://marketplace.gohighlevel.com/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [MCP Servers en GitHub](https://github.com/nerdsnipe-inc/ghl-mcp-server)

---

## 📝 **Notas Adicionales**
- **Ubicaciones:** Este proyecto solo accede a la ubicación *Control Ads* (`kNcygEmVTrhIueZQMDXM`).
- **Administradores:** Los usuarios con rol `admin` en esta ubicación son:
  - Alejandro Tenorio (`hermes.tenorio@chateapro.com`)
  - Faiders Altamar (`soft@scale.com.co`)
  - Johan Camilo Torres (`johan@scale.com.co`)
- **Límites de tasa:** 100 solicitudes por 10 segundos por token.

---

**¿Preguntas?**
Si necesitas ayuda con algún paso, revisa los logs o ejecuta `curl` directamente para diagnosticar el problema.