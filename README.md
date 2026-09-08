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

## Administracion de productos (FR-03, FR-04, FR-05)

Interfaz para el personal de la carniceria: listado, alta, modificacion y
eliminacion de productos. Lo que se guarda se ve en el catalogo al momento.

- Listado: <http://localhost:4200/admin/productos>
- Crear: <http://localhost:4200/admin/productos/nuevo>
- Modificar: `/admin/productos/<id>/editar` (boton *Editar* de cada fila)
- Eliminar: boton *Eliminar* de cada fila, con confirmacion en la propia fila

Endpoints:

| Metodo | Ruta | Para que |
|---|---|---|
| `POST` | `/api/productos/` | Alta. El `slug` se calcula del nombre si no se envia. |
| `GET` | `/api/productos/<id>/` | Datos de un producto con la categoria como id. |
| `PATCH` | `/api/productos/<id>/` | Modificacion. |
| `DELETE` | `/api/productos/<id>/` | Eliminacion (archiva, ver abajo). |
| `GET` | `/api/categorias/` | Categorias para el selector (sin paginar). |

Renombrar un producto **no** le cambia el `slug`: es su direccion publica y
moverla romperia los enlaces que ya circulan. Para cambiarlo hay que enviarlo
a proposito.

### Eliminar archiva, no borra

`DELETE` marca el producto como `archivado`: desaparece del catalogo y de la
administracion (`GET`, `PATCH` y `DELETE` sobre el responden 404), pero la fila
se conserva para que lo que ya la referencie siga teniendo a que apuntar.

Para recuperarlo hay que quitarle la marca desde el admin de Django, en
<http://localhost:8001/admin/> (la columna *archivado* se edita desde el
listado). Recargar los datos de ejemplo con `cargar_catalogo` tambien los
devuelve al catalogo.

En el codigo, `Producto.objects.visibles()` es el queryset que excluye los
archivados: toda consulta nueva sobre el catalogo deberia partir de ahi.

> **Sin autenticacion todavia.** El `POST` esta abierto porque el inicio de
> sesion es FR-02 y aun no existe. Queda un `TODO(FR-02)` en
> `backend/apps/catalog/views.py` para cambiarlo a `IsAdminUser`. No desplegar
> asi.
