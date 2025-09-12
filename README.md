# Dealroom Finsolar (Netlify + GitHub)

**Objetivo:** un dealroom digital para inversionistas que centraliza documentación (NDA, propuestas, modelos, contratos, LOIs, sustentos, mitigación de riesgos, procesos) y muestra **avance del roadmap** por inversionista, proyectos activos y **fechas límite**. Basado 100% en **GitHub + Netlify (Identity + Functions)**.

---

## 1) Stack

- **Frontend:** React + Vite (SPA), HashRouter.
- **Auth & Roles:** Netlify Identity (`investor`, `ri`, `admin`).
- **Backend serverless:** Netlify Functions (Node 18 ESM).
- **Storage de documentos y datos:** GitHub (repos privados). Acceso vía API desde Functions.
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

## 3) Roles y control de acceso

- `investor`: acceso solo a su carpeta de documentos `/<Categoría>/<slug>/...` y a su propio estado.
- `ri` o `admin`: acceso total (todas las carpetas y funciones de escritura).
- Resolución de **slug** por dominio de email (`data/investor-index.json`). Ejemplo: `femsa.com -> femsa`.

> Puedes extender el mapping o migrarlo a un repo privado.

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

# Token Admin de Netlify Identity
IDENTITY_ADMIN_TOKEN=netlify_identity_admin_token
```

> Sin `GITHUB_TOKEN`, el sitio funciona en modo demo (lee `/data` local y no lista documentos).

---

## 5) Flujo de documentos (solo GitHub + Netlify)

- **Listar:** `/.netlify/functions/list-docs?category=NDA` devuelve archivos en `NDA/<slug>/`.
- **Subir:** UI de `/documents` llama `upload-doc` → commit al repo de documentos.
- **Descargar:** `get-doc` stream del archivo desde GitHub con verificación de rol/slug.
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
  8. Due diligence fiscal/financiero/riesgos → 9. Revisión de contratos →
  10. Cronograma de inversión → 11. Firma de contratos
- Fechas límite por etapa se guardan en `data/investors/<slug>.json` (o en el repo de contenido vía función).
- Botón **ICS** genera un calendario descargable (sin servicios externos).

---

## 7) Despliegue paso a paso

1. **Crear repo en GitHub** con este proyecto (público o privado).
2. **Crear sitio en Netlify** desde ese repo.
3. En Netlify → **Identity**: habilitar, **Invite-only**, y roles (`investor`, `ri`, `admin`).
4. En Netlify → **Environment variables**: configurar `GITHUB_TOKEN`, `CONTENT_REPO`, `DOCS_REPO`.
5. **Invitar usuarios**. Para mapear a un `slug`, agrega el dominio a `data/investor-index.json` y haz deploy.
6. (Opcional) Crear **repo privado** aparte para documentos y poner su nombre en `DOCS_REPO`.
7. Probar:
   - Subir un archivo en `/documents` (debería ir a `/<Categoría>/<slug>/`).
   - Verlo listado y descargarlo.
   - Actualizar estado en `/admin` y comprobar commit en GitHub y rebuild automático.

---

## 8) Seguridad y limitaciones (cándido)

- **RBAC real**: la autorización se hace **en Functions**, no en assets estáticos, por lo que los documentos **no** se exponen públicamente.
- **Gestión de usuarios**: Identity no permite (UI) editar metadatos complejos; por eso resolvemos slug por **dominio**. Si algún inversionista usa Gmail, mapea su dominio corporativo o gestiona su slug manualmente (puedes crear función adicional para admin).
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
- **MFA** via Netlify Identity + enforced roles.
```)

## 12) Pruebas manuales create-investor

1. **Caso feliz** (dominio nuevo): llenar el formulario en `/admin` con un dominio corporativo y verificar que se crean commits en `data/investor-index.json`, `data/investors/<slug>.json` y las carpetas en el repo de documentos. Debe enviarse la invitación Identity.
2. **Mapping existente**: repetir con el mismo dominio y confirmar que no falla y los commits retornan `null` donde no hubo cambios.
3. **Dominio genérico**: usar un correo de `gmail.com`; el slug se deriva del nombre y no se crea mapping.
4. **Sin permisos**: probar con un usuario sin rol `ri`/`admin` y verificar respuesta 403.
5. **Falta IDENTITY_ADMIN_TOKEN**: remover la variable y confirmar que la función responde 500 con mensaje claro.
