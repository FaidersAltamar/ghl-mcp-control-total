# Kit de Instrucciones para una IA en otra computadora

Este kit permite que **cualquier IA (Cursor / Claude / OpenCode)** abra esta carpeta en una máquina nueva y conecte con GHL sin reinventar la autenticación.

---

## 1. Credenciales — un solo archivo

| Ruta | Qué contiene | ¿Vence? |
|---|---|---|
| **`.env`** (raíz del proyecto) | PIT token, refresh token Firebase, location ID, OAuth (opcional) | PIT: no · Refresh: autorenovable |

Copia la plantilla:

```powershell
copy .env.example .env
```

Si migras desde una instalación antigua (credenciales en `.mcp.json` o `mcp-server/.env`):

```powershell
node scripts/migrate-env.mjs
```

---

## 2. Servidores MCP

| Servidor | Auth | Para qué |
|---|---|---|
| `ghl` | `GHL_PIT_TOKEN` | API pública (127 tools) |
| `ghl-workflow-builder` | `GHL_FIREBASE_REFRESH_TOKEN` | Workflows CRUD |

El `.mcp.json` **no tiene secretos** — lanza `scripts/run-ghl-*.mjs` que leen `.env`.

---

## 3. Verificación (lo primero en máquina nueva)

### Requisitos
- Node.js 18+
- `.env` completo en la raíz

### Probar workflows (Firebase)

```powershell
node scripts/workflows/list.mjs
```

~18 workflows → conexión OK.

### Probar API pública (PIT)

```powershell
# Cargar .env en la sesión (PowerShell)
Get-Content .env | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { Set-Item "env:$($matches[1].Trim())" $matches[2].Trim() } }
curl.exe -s -H "Authorization: Bearer $env:GHL_PIT_TOKEN" -H "Version: 2021-07-28" "https://services.leadconnectorhq.com/social-media-posting/$env:GHL_LOCATION_ID/accounts"
```

`"success": true` → PIT OK.

> En PowerShell 5.1 usa `curl.exe`, no `curl` (alias de Invoke-WebRequest).

---

## 4. Emergencia: refresh token revocado

Si `list.mjs` devuelve 401:

1. Lee `tools/auth-bridge/README.md`
2. Extrae nuevo `refreshToken` de GHL en Chrome
3. Actualiza `GHL_FIREBASE_REFRESH_TOKEN` en **`.env` raíz**
4. Vuelve a correr `node scripts/workflows/list.mjs`

---

## 5. Regla de oro

> **No reinventes la autenticación.** Todo vive en `.env` raíz. Los scripts y MCP servers lo cargan solos. Solo regenera el refresh token si hay 401 real.

---

## 6. Referencia rápida

| Dato | Variable en `.env` |
|---|---|
| Location ID | `GHL_LOCATION_ID` |
| Company ID | `GHL_COMPANY_ID` |
| PIT token | `GHL_PIT_TOKEN` |
| Firebase refresh | `GHL_FIREBASE_REFRESH_TOKEN` |
| Guía completa agente | `CLAUDE.md` |
