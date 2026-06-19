# GHL Workflow Extractor for OpenCode / Claude Code

Extensión de Chrome que extrae los workflows de GoHighLevel (activos y borradores) con todos sus triggers y pasos, y los envía a un servidor local para que OpenCode o Claude Code puedan analizarlos en el chat.

**No exporta JSON ni crea dashboards.** La idea es que tú sigas interactuando con el asistente de IA y le pidas: _"muéstrame qué hace el workflow de Compra producto"_, _"cuántos triggers tiene"_, _"qué workflows tienen email"_, etc.

---

## ¿Qué necesitas?

1. Tener acceso a GoHighLevel como admin de la location `Control Ads`.
2. Google Chrome o Microsoft Edge.
3. Esta carpeta `ghl-workflow-extractor/` en tu computadora.

---

## Instalación (3 minutos)

### Paso 1: Iniciar el servidor local

Abre una terminal en esta carpeta y ejecuta:

```bash
node server.js
```

Dejarla corriendo. Verás:

```
🚀 Servidor listo en http://localhost:8765
   Endpoint de captura: POST /capture
   Estado:              GET  /status
   Archivo de salida:   .../ghl-workflow-extractor/workflows-live.json
```

### Paso 2: Cargar la extensión en Chrome

1. Abre Chrome y ve a `chrome://extensions`.
2. Activa **Developer mode** (modo desarrollador) arriba a la derecha.
3. Click en **Load unpacked** (Cargar descomprimida).
4. Selecciona la carpeta `ghl-workflow-extractor`.
5. La extensión aparecerá como "GHL Workflow Extractor for OpenCode".

### Paso 3: Extraer workflows

1. Ve a GoHighLevel → **Automation → Workflows**.
2. Verás que al lado del botón "Create Workflow" aparece un nuevo botón: **"Enviar a OpenCode"**.
3. Haz clic en él.
4. Espera unos segundos mientras lee todos los workflows, triggers y pasos.
5. Cuando diga "¡Enviado!", los datos ya están en `workflows-live.json`.

**Si usas dominio white-label (ej. `crm.dropi.co`):**
La extensión ahora también está configurada para correr dentro del iframe de workflows de GHL. Si no aparece el botón:
- Recarga la extensión en `chrome://extensions` (icono de recarga).
- Recarga la página de Workflows (`F5`).
- Si sigue sin aparecer, usa el **fallback de consola** (ver abajo).

### Paso 4: Volver al chat de OpenCode / Claude Code

Dile algo como:

> "Ya extraje los workflows. Muéstrame qué automatizaciones tengo y qué hace cada una."

El asistente leerá `workflows-live.json` y responderá con el desglose.

---

## Seguridad

- El token de sesión de GHL se guarda solo en tu computadora, dentro de `workflows-live.json`.
- Ese archivo está en `.gitignore` y no se sube a GitHub.
- El servidor solo escucha en `localhost`, nadie fuera de tu máquina puede conectarse.
- El token expira en ~1 hora, así que no sirve para siempre.

---

## Solución de problemas

| Problema | Solución |
|---|---|
| No aparece el botón | Recarga la página de Workflows (F5). Asegúrate de estar en `Automation → Workflows`. |
| "No hay token" | Abre cualquier workflow (haz clic en uno) y vuelve a la lista. Luego intenta de nuevo. |
| "Error del servidor local" | Asegúrate de que `node server.js` esté corriendo en otra terminal. |
| Chrome bloquea localhost | La extensión ya pide permiso para `http://localhost:8765/*`. Si falla, desinstala y vuelve a cargar la extensión. |
| Uso dominio white-label y no aparece el botón | Usa el fallback de consola (sección siguiente) o recarga la extensión. |

---

## Fallback: pegar script en consola

Si la extensión no se activa en tu dominio white-label, usa el archivo `console-fallback.js`.

1. Asegúrate de que `node server.js` esté corriendo.
2. Abre GHL → **Automation → Workflows**.
3. Abre DevTools (`F12` o `Cmd+Option+I`).
4. Si estás en un iframe, usa el menú desplegable de DevTools (arriba a la izquierda) para seleccionar el iframe que contiene `leadconnectorhq.com`.
5. Ve a la pestaña **Console**.
6. Abre el archivo `console-fallback.js` en tu editor, copia TODO el contenido.
7. Pégalo en la consola y presiona **Enter**.
8. Espera a que termine y diga "¡Listo!".

Vuelve al chat y di: "Ya extraje los workflows".

---

## Archivos importantes

| Archivo | Para qué sirve |
|---|---|
| `server.js` | Servidor local que recibe workflows y los guarda. |
| `content-opencode.js` | Script de la extensión que lee workflows y envía datos. |
| `page-hook.js` | Captura el token de sesión de GHL. |
| `manifest.json` | Configuración de la extensión. |
| `workflows-live.json` | Aquí se guardan los datos extraídos (no se sube a Git). |
