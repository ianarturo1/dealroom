# Dealroom Finsolar (Netlify + GitHub)

**Objetivo:** un dealroom digital para inversionistas que centraliza documentación (NDA, propuestas, modelos, contratos, LOIs, sustentos, mitigación de riesgos, procesos) y muestra **avance del roadmap** por inversionista, proyectos activos y **fechas límite**. Basado 100% en **GitHub + Netlify Functions**.

---

## 1) Stack

- **Frontend:** React + Vite (SPA), HashRouter.
- **Backend serverless:** Netlify Functions (Node 18 ESM).
- **Storage de documentos y datos:** GitHub (repos privados). Acceso vía API desde Functions.
- **Acceso:** sitio público; el slug de inversionista se controla vía query string (`?investor=`) o variable de entorno.
- **Branding:** Raleway (títulos), Lato (cuerpo). Colores: Púrpura `#7F4DAB`, Naranja `#F49A00`.

> No se requiere infraestructura adicional fuera de GitHub y Netlify.

---

## 2) Estructura principal

```
/netlify/functions/*.mjs         # API (docs, investor, calendar, commits)
/data/*                          # Datos semilla (proyectos, índice de inversionistas)
/src/*                           # App React
/netlify.toml                    # Build + functions + SPA fallback
```

Rutas UI:
- `/` **Panel** con progreso por etapas, fechas límite (ICS), y KPIs.
- `/projects` **Proyectos activos** (potencia, cliente, ubicación, CO₂, energía).
- `/documents` **Biblioteca** por categoría + **upload** (commit a GitHub).
- `/admin` **Relaciones con inversionistas** (actualizar estado y métricas).
- `/updates` Noticias internas del dealroom.

---

## 3) Acceso público

- Todo el contenido del dashboard es público; no se requieren tokens ni login.
- El slug del inversionista visible se resuelve desde la query string `?investor=<slug>` o desde la variable de entorno `PUBLIC_INVESTOR_SLUG`/`VITE_PUBLIC_INVESTOR_ID` (por defecto `femsa`).
- Los documentos siguen viviendo en GitHub. Las funciones validan que las rutas solicitadas correspondan al slug público configurado.

> Puedes generar enlaces compartibles usando `/#/?investor=<slug>`.

---

## 4) Repos GitHub y variables de entorno

Puedes usar **un solo repo** (el del sitio) para datos y **otro repo privado** para documentos.

En Netlify → *Site settings* → *Environment variables*:

```
# Repo con data (puede ser el mismo del sitio)
CONTENT_REPO=owner/nombre-del-repo
CONTENT_BRANCH=main

# Repo privado de documentos
DOCS_REPO=owner/nombre-del-repo-docs
DOCS_BRANCH=main

# Token con permisos de contents:read/write en ambos repos
GITHUB_TOKEN=ghp_xxx

# Slug público por defecto (opcional)
PUBLIC_INVESTOR_SLUG=femsa

# Slug público para el build del frontend (opcional)
VITE_PUBLIC_INVESTOR_ID=femsa
```

> Sin `GITHUB_TOKEN`, el sitio funciona en modo demo (lee `/data` local y no lista documentos).

---

## 5) Flujo de documentos (solo GitHub + Netlify)

- **Listar:** `/.netlify/functions/list-docs?category=NDA` devuelve archivos en `NDA/<slug>/`.
- **Subir:** UI de `/documents` llama `upload-doc` → commit al repo de documentos.
- **Descargar:** `get-doc` entrega el archivo desde GitHub siempre que pertenezca al slug público configurado.
- **Auditoría:** el historial de cambios queda en GitHub (quién y qué).

> Sugerencia: estructura de carpetas en el repo de docs
>
> ```
> NDA/<slug>/*.pdf
> Propuestas/<slug>/*.pdf
> Modelos financieros/<slug>/*.xlsx
> Contratos/<slug>/*.docx
> LOIs/<slug>/*.pdf
> Sustento fiscal/<slug>/*.pdf
> Mitigación de riesgos/<slug>/*.pdf
> Procesos/<slug>/*.pdf
> ```

---

## 6) KPI y roadmap

- Etapas fijas (editable en código):
  1. Primera reunión → 2. NDA → 3. Entrega de información → 4. Generación de propuesta →
  5. Presentación de propuesta → 6. Ajustes técnicos → 7. LOI →
  8. Revisión de contratos → 9. Due diligence fiscal/financiero/riesgos →
  10. Cronograma de inversión → 11. Firma de contratos
- Fechas límite por etapa se guardan en `data/investors/<slug>.json` (o en el repo de contenido vía función).
- Botón **ICS** genera un calendario descargable (sin servicios externos).

---

## 7) Despliegue paso a paso

1. **Crear repo en GitHub** con este proyecto (público o privado).
2. **Crear sitio en Netlify** desde ese repo.
3. En Netlify → **Environment variables**: configurar `GITHUB_TOKEN`, `CONTENT_REPO`, `DOCS_REPO` y, si quieres personalizar el slug público, `PUBLIC_INVESTOR_SLUG`/`VITE_PUBLIC_INVESTOR_ID`.
4. **Crear inversionistas** desde `/admin` para generar JSONs y enlaces públicos (`/#/?investor=<slug>`).
5. (Opcional) Crear **repo privado** aparte para documentos y poner su nombre en `DOCS_REPO`.
6. Probar:
   - Subir un archivo en `/documents` (debería ir a `/<Categoría>/<slug>/`).
   - Verlo listado y descargarlo.
   - Actualizar estado en `/admin` y comprobar commit en GitHub y rebuild automático.

---

## 8) Seguridad y limitaciones (cándido)

- **Datos públicos**: todo el contenido queda expuesto sin autenticación. Usa repos y datos que puedas compartir públicamente.
- **Slug fijo**: las funciones solo permiten leer/escribir dentro del slug configurado (`PUBLIC_INVESTOR_SLUG`). Cambia ese valor para publicar otro inversionista.
- **Notificaciones**: el PRD pedía notificaciones; con la restricción "solo GitHub y Netlify" se implementa **feed interno + ICS**. Para email/slack necesitarías un servicio externo. Alternativa mínima: los **commits** en GitHub ya notifican a los watchers (equipo interno).
- **Uploads**: quedan auditablemente versionados en GitHub. Si el tamaño de archivos crece, considera Git LFS (también solo GitHub).

---

## 9) Personalización rápida de marca

Variables de color/typografía en `src/styles.css`. Logos en `/public/logo.svg` y `/public/favicon.svg` siguiendo la guía (Raleway + Lato, púrpura/orange).

---

## 10) Scripts útiles

```bash
npm i
npm run dev   # local
npm run build # genera /dist
```

---

## 11) Extensiones recomendadas (futuro)

- **Firmas de NDA/LOI** con GitHub PRs + checks (sin salirte de GH/NF).
- **Reportes** (CSV/JSON) desde Functions para métricas trimestrales.

## 12) Pruebas manuales create-investor

1. Crear un inversionista desde `/admin` y verificar los commits en `data/investor-index.json` y `data/investors/<slug>.json`.
2. Abrir el enlace público que devuelve la función (`/#/?investor=<slug>`) y comprobar que el dashboard muestra la información del nuevo slug.
3. Subir un archivo en `/documents` para validar que se versiona dentro de la carpeta `<Categoría>/<slug>/` en el repo de documentos.
