# auth-bridge — Extracción portable del token de GHL

Autoriza el MCP de workflows (`ghl-workflow-builder`) usando el **refresh token de
Firebase** que tu propia sesión de GHL guarda en tu Chrome. Es **por eso que no
caduca**: a diferencia del JWT corto (que expira en ~1 h), el refresh token nunca
expira, así que el servidor puede renovar el acceso solo y para siempre.

Todo vive dentro de esta carpeta del proyecto → puedes copiar la carpeta completa
a otra computadora y volver a extraer el token ahí sin perder nada.

---

## 1. ¿De dónde sale el refresh token?

Cuando entras a `crm.dropi.co` y te logueas, GHL (que usa Firebase) guarda en tu
Chrome una base de datos interna llamada:

```
IndexedDB → firebaseLocalStorageDb → store firebaseLocalStorage
```

Dentro hay una fila con clave `firebase:authUser:<proyecto>:[DEFAULT]` cuyo JSON
contiene el campo `refreshToken` (empieza con `AMf-`). Ese valor ES el refresh
token. No lo escribimos a mano: `extract-auth.mjs` lo lee solo y lo pone en el
`.env` del servidor MCP.

`.env` del proyecto (raíz):

```
GHL_LOCATION_ID=your_location_id
GHL_FIREBASE_REFRESH_TOKEN=AMf-...
```

Al arrancar, `server.js`:
1. Toma el refresh token.
2. Lo cambia por un token temporal (id_token) en
   `securetoken.googleapis.com/v1/token` (válido 1 h) y lo guarda en memoria.
3. Manda ese token con el header `token-id` a `backend.leadconnectorhq.com`.
4. Cuando expira, repite el paso 2 automáticamente.

Por eso ya **no necesitas** estar copiando el JWT Bearer a mano cada vez.

---

## 2. Extraer el token (en esta computadora)

El script necesita hablar con el navegador abierto. Hay dos formas:

### Opción A — CDP directo con tu Chrome (recomendado, funciona sin extensiones)

1. Abre `launch-chrome.ps1`:
   ```powershell
   powershell -ExecutionPolicy Bypass -File launch-chrome.ps1
   ```
   (abre una ventana de Chrome con depuración en el puerto 9222).
2. Entra a `crm.dropi.co` y loguéate (o deja abierta tu sesión ya iniciada).
3. En otra terminal:
   ```bash
   node extract-auth.mjs
   ```
4. Verás un resumen enmascarado y habrá escrito `../mcp-server/.env`.

### Opción B — Mijo Browser (la extensión)

El flujo probado por el agente: en la pestaña logueada de `crm.dropi.co`, el
agente inyecta un `div id="__tokdump"` vía `mijo-browser_evaluate` que lee
`firebaseLocalStorageDb` y `localStorage`, y lo lee con `mijo-browser_get_html`.
Este método funcionó y arrojó el refresh token `AMf-vBzz...`.

Ambas rutas leen exactamente el mismo dato (el refresh token de tu sesión).

---

## 3. Mover a otra computadora (portable)

1. Copia **toda** la carpeta `GHL MCP` (incluida `ghl-workflow-builder/`).
2. En la otra máquina, con tu Chrome logueado en `crm.dropi.co`, corre
   `launch-chrome.ps1` + `extract-auth.mjs` para regenerar el `.env` local.
3. Eso es todo: los tokens nunca viajan en git (están en `.gitignore`), siempre
   se re-extraen de la sesión de la máquina actual.

> Nota: en realidad el refresh token del paso 3 ya funciona desde el `.env` del
> paso 2 (no caduca). El paso 3 solo se necesita si en tu Chrome se cerró la
> sesión o se rotó el proyecto de Firebase.

---

## Archivos en esta carpeta

| Archivo | Qué hace |
|---------|----------|
| `launch-chrome.ps1` | Abre Chrome con depuración remota (puerto 9222). |
| `launch-chrome.mjs` | Variante en Node que lanza Chrome CDP. |
| `cdp-lib.mjs` | Helper WebSocket CDP (listar pestañas / conectar / evaluar / IndexedDB / localStorage). |
| `extract-auth.mjs` | Lee `firebaseLocalStorageDb` + `localStorage`, extrae tokens y los escribe en `../mcp-server/.env`. Flags: `--stdout` (solo previsualizar), `--env archivo`. |
| `README.md` | Este archivo. |

---

## Seguridad

- `.env` y los tokens están en `.gitignore` (no se suben).
- El refresh token da acceso solo a tu location `kNcygEmVTrhIueZQMDXM`.
- No lo compartas; cualquier persona que lo tenga podría usar la API interna de
  workflows de tu cuenta.
