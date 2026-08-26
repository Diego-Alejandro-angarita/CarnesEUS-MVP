# CarnesEUS — MVP

E-commerce para carnicería: catálogo de cortes, carrito, checkout con pago en
línea y panel de gestión para el personal.

> **Estado:** el entorno está montado y funcionando, pero **no hay ninguna
> historia de usuario implementada todavía**. Este repositorio es el punto de
> partida para que el equipo construya el MVP.

- **Backend:** Django 5.2 LTS + Django REST Framework (monolito modular)
- **Frontend:** Angular 21 (standalone, signals, zoneless)
- **Base de datos:** PostgreSQL 16
- **Documentación del Sprint 0:** [wiki del proyecto](https://github.com/Diego-Alejandro-angarita/CarnesEUS-MVP/wiki)

---

## Requisitos

| Herramienta | Versión |
|---|---|
| Docker Desktop | 24+ |
| Python | 3.13 |
| Node.js | 22 |

Con Docker basta para levantar todo. Python y Node solo hacen falta si prefieres
correr los servicios a mano.

---

## Arranque rápido

```bash
cp backend/.env.example backend/.env
```

```bash
docker compose up --build
```

- Aplicación: <http://localhost:4200>
- API: <http://localhost:8001/api/>
- Documentación de la API: <http://localhost:8001/api/docs/>
- Admin de Django: <http://localhost:8001/admin/>

La pantalla de inicio comprueba sola que las tres piezas están conectadas: llama
a `/api/salud/` a través del proxy y muestra el resultado.

> **Puertos:** el backend se publica en el **8001** y Postgres en el **5433**,
> no en los puertos habituales. El 8000 y el 5432 suelen estar ocupados por
> otras aplicaciones y por instalaciones locales de PostgreSQL. Dentro de
> Docker siguen siendo 8000 y 5432; solo cambia lo que se expone al host.

Para crear un usuario del admin:

```bash
docker compose exec backend python manage.py createsuperuser
```

---

## Antes de la primera historia: el modelo de usuario

Si el equipo va a usar un usuario propio (login por correo, roles, campos
extra), hay que definirlo **antes de la primera migración**. Django solo permite
fijar `AUTH_USER_MODEL` con la base limpia; cambiarlo después, con datos encima,
es un dolor de cabeza evitable.

1. Crear la app `apps/accounts` con el modelo `Usuario`.
2. Descomentar `AUTH_USER_MODEL = "accounts.Usuario"` en
   [`config/settings/base.py`](backend/config/settings/base.py).
3. Si ya se corrió `docker compose up` (que migra al arrancar), borrar la base:

```bash
docker compose down -v
```

---

## Cómo agregar una historia de usuario

### Backend

```bash
docker compose exec backend python manage.py startapp catalog apps/catalog
```

1. En `apps/catalog/apps.py`, poner `name = "apps.catalog"` y un `label`.
2. Registrar `"apps.catalog"` en `LOCAL_APPS` de `config/settings/base.py`.
3. Escribir modelos, serializers, vistas y `urls.py` de la app.
4. Incluir sus rutas en `config/urls.py` (hay ejemplos comentados).
5. Generar la migración:

```bash
docker compose exec backend python manage.py makemigrations
```

### Frontend

1. Crear el componente en `src/app/features/<historia>/`.
2. Agregar la ruta en `src/app/app.routes.ts` con `loadComponent` (hay un
   ejemplo comentado).
3. Los servicios HTTP van en `src/app/core/services/`, los guards en
   `src/app/core/guards/` y lo reutilizable en `src/app/shared/`.

Cuando exista la primera pantalla real, borrar la bienvenida de `app.html` y
dejar solo `<router-outlet />`.

---

## Estructura

```
backend/
├─ config/
│  ├─ settings/         base.py · dev.py · prod.py
│  └─ urls.py           rutas de la API
├─ apps/
│  └─ common/           TimeStampedModel, paginación, endpoint de salud
└─ tests/               prueba de humo

frontend/src/app/
├─ core/                servicios, guards, interceptores, modelos
├─ shared/              pipes y piezas reutilizables
├─ features/            una carpeta por historia de usuario
└─ styles/              tokens de diseño
```

Las carpetas de dominio están vacías a propósito. El monolito modular es el que
define *Arquitectura* en la
[wiki](https://github.com/Diego-Alejandro-angarita/CarnesEUS-MVP/wiki): un solo
despliegue, con fronteras claras entre módulos.

---

## Qué trae ya montado

Nada de dominio; solo la infraestructura que cuesta configurar:

| Pieza | Dónde |
|---|---|
| Ajustes por entorno (`base`/`dev`/`prod`) | `backend/config/settings/` |
| Conexión a Postgres por `DATABASE_URL` | `backend/config/settings/base.py` |
| DRF con paginación, filtros y sesión por cookie | `REST_FRAMEWORK` en `base.py` |
| Documentación automática de la API | `/api/docs/` (drf-spectacular) |
| Endpoint de comprobación | `backend/apps/common/views.py` |
| `TimeStampedModel` y paginación estándar | `backend/apps/common/` |
| Cabeceras de seguridad y HTTPS para producción | `backend/config/settings/prod.py` |
| Proxy de `/api` y `/media` hacia Django | `frontend/proxy.conf.mjs` |
| CSRF de Angular ajustado a Django | `frontend/src/app/app.config.ts` |
| Locale `es-CO` | `frontend/src/app/app.config.ts` |
| pytest + ruff / vitest | `backend/pyproject.toml`, `frontend/package.json` |
| Integración continua | `.github/workflows/ci.yml` |

### Sesión con cookies y CSRF

Angular usa por defecto la cookie `XSRF-TOKEN` y el header `X-XSRF-TOKEN`;
Django espera `csrftoken` y `X-CSRFToken`. El ajuste está en `app.config.ts`,
para dejar el backend con su configuración estándar.

En desarrollo el servidor de Angular hace *proxy* de `/api` hacia el backend
([`proxy.conf.mjs`](frontend/proxy.conf.mjs)), así que para el navegador todo es
un solo origen: no hay CORS de por medio y las cookies de sesión viajan solas.

---

## Pruebas

```bash
docker compose exec backend pytest
```

```bash
docker compose exec frontend npm test
```

El backend trae una prueba de humo (`tests/test_salud.py`) y el frontend tres
sobre el componente raíz. Son el andamio para las pruebas reales.

Lint del backend:

```bash
docker compose exec backend ruff check .
```

---

## Si el editor marca «Cannot find module '@angular/router'»

El contenedor guarda sus `node_modules` en un volumen anónimo, invisible desde
Windows. Al clonar, `frontend/node_modules` queda vacío en el disco, así que VS
Code no encuentra ningún paquete aunque la aplicación compile bien dentro del
contenedor.

Se arregla instalando las dependencias también en la máquina, solo para que el
editor las vea:

```bash
cd frontend && npm ci
```

No interfiere con el contenedor: la copia del volumen es la que se usa al
ejecutar.

---

## Ejecutar sin Docker

La base de datos igual hace falta:

```bash
docker compose up -d db
```

### Backend

```bash
cd backend && python -m venv .venv && .venv/Scripts/activate && pip install -r requirements/dev.txt && cp .env.example .env && python manage.py migrate && python manage.py runserver 8001
```

En Linux o macOS, `source .venv/bin/activate`.

### Frontend

```bash
cd frontend && npm install && npm start
```
