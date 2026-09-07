# CarnesEUS — MVP

E-commerce para carnicería: catálogo de cortes, carrito, checkout con pago en
línea y panel de gestión para el personal.

- **Backend:** Django 5.2 LTS + Django REST Framework
- **Frontend:** Angular 21
- **Base de datos:** PostgreSQL 16

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

> **Puertos:** el backend se publica en el **8001** y Postgres en el **5433**,
> no en los puertos habituales. El 8000 y el 5432 suelen estar ocupados por
> otras aplicaciones y por instalaciones locales de PostgreSQL. Dentro de
> Docker siguen siendo 8000 y 5432; solo cambia lo que se expone al host.

Para crear un usuario del admin:

```bash
docker compose exec backend python manage.py createsuperuser
```

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

---

## Catalogo de productos (FR-00)

Datos de ejemplo para ver el catalogo funcionando:

```bash
docker compose exec backend python manage.py cargar_catalogo
```

- Vista de catalogo: <http://localhost:4200/productos>
- Listado paginado: <http://localhost:8001/api/productos/> (publico, admite
  `?page=` y `?page_size=`)

Los productos se administran desde el admin de Django, en
<http://localhost:8001/admin/>.

---

## Crear producto (FR-03)

Primera pantalla de la interfaz de administracion: da de alta un producto y
queda publicado en el catalogo.

- Formulario: <http://localhost:4200/admin/productos/nuevo>
- Alta de producto: `POST /api/productos/` (el `slug` se calcula a partir del
  nombre si no se envia)
- Categorias para el selector: <http://localhost:8001/api/categorias/>
  (publico, sin paginar)

> **Sin autenticacion todavia.** El `POST` esta abierto porque el inicio de
> sesion es FR-02 y aun no existe. Queda un `TODO(FR-02)` en
> `backend/apps/catalog/views.py` para cambiarlo a `IsAdminUser`. No desplegar
> asi.
