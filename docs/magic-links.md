# Magic links

Este proyecto usa enlaces firmados para autenticar a inversionistas sin Netlify Identity.

## Flujo

1. En `/admin`, se crea al inversionista con su correo y nombre.
2. La función `create-investor` guarda los datos en GitHub y responde con un link firmado (`/i/<slug>?t=<jwt>`).
3. Al abrir el link, la Edge Function `auth` valida el token y lo guarda en una cookie para las siguientes visitas.

## Variables de entorno

Configura en Netlify → **Environment variables**:

- `SIGNING_SECRET`: clave usada para firmar/verificar los tokens (no se versiona).
- `SITE_URL`, `GITHUB_TOKEN`, `CONTENT_REPO` y opcional `CONTENT_BRANCH` ya existentes.

## TTL y revocación

- El token expira en **7 días** (`expiresIn: "7d"` en `create-investor`). Ajusta ese valor para cambiar el TTL.
- Para revocar todos los enlaces activos, rota `SIGNING_SECRET` en Netlify y vuelve a desplegar.
