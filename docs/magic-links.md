# Acceso público

El dealroom ahora es 100% público: no hay login ni Netlify Identity. Todo el contenido visible depende únicamente del slug que se indique en la URL o en las variables de entorno.

## Cómo funciona

1. Desde `/admin` puedes crear o actualizar inversionistas. La función `create-investor` genera los JSON en GitHub y devuelve un enlace compartible del tipo `/#/?investor=<slug>`.
2. El frontend lee el parámetro `investor` del hash (`HashRouter`) y consulta el backend usando ese slug.
3. Las funciones serverless restringen lecturas/escrituras al slug público configurado (`PUBLIC_INVESTOR_SLUG`).

## Variables de entorno relevantes

- `PUBLIC_INVESTOR_SLUG`: define el slug habilitado en las funciones (`femsa` por defecto).
- `VITE_PUBLIC_INVESTOR_ID`: slug usado por el build de Vite si no hay query string (`femsa` por defecto).
- `SITE_URL`, `GITHUB_TOKEN`, `CONTENT_REPO`, `DOCS_REPO` y ramas (`CONTENT_BRANCH`/`DOCS_BRANCH`) siguen siendo obligatorios para los commits.

> Para compartir un inversionista diferente basta con actualizar los JSON correspondientes y ajustar `PUBLIC_INVESTOR_SLUG`/`VITE_PUBLIC_INVESTOR_ID` (o usar la query `/#/?investor=...`).
