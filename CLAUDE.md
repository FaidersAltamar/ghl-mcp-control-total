# GHL MCP — Guía para agentes IA

> Documentación completa: [`docs/agent-guide.md`](docs/agent-guide.md)

## Reglas rápidas

1. **Credenciales** → solo en `.env` raíz (nunca en código ni commits).
2. **MCP primero** — API pública (`ghl`) y workflows (`ghl-workflow-builder`).
3. **Fallback** → `tools/api-client/ghl-client.js` si MCP no alcanza.
4. **Workflows** → MCP `ghl-workflow-builder`; referencia en `reference/workflows/`.
5. **Destructivos** → confirmar con el usuario antes de borrar/publicar masivo.

## Verificar conexión

```bash
node scripts/verify-connection.mjs
node scripts/workflows/list.mjs
```

## Estructura

Ver [`docs/STRUCTURE.md`](docs/STRUCTURE.md).
