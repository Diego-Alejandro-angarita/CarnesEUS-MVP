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

## Administracion de productos (FR-03, FR-04, FR-05, FR-09)

Interfaz para el personal de la carniceria: listado, alta, modificacion y
eliminacion de productos. Lo que se guarda se ve en el catalogo al momento.

- Listado: <http://localhost:4200/admin/productos>
- Crear: <http://localhost:4200/admin/productos/nuevo>
- Modificar: `/admin/productos/<id>/editar` (boton *Editar* de cada fila)
- Eliminar: boton *Eliminar* de cada fila, con confirmacion en la propia fila
- Cambiar disponibilidad: la etiqueta *Disponible* / *Agotado* de cada fila es
  un boton; al pulsarla el producto cambia de estado sin abrir el formulario

Endpoints:

| Metodo | Ruta | Para que |
|---|---|---|
| `POST` | `/api/productos/` | Alta. El `slug` se calcula del nombre si no se envia. |
| `GET` | `/api/productos/<id>/` | Datos de un producto con la categoria como id. |
| `PATCH` | `/api/productos/<id>/` | Modificacion. |
| `PATCH` | `/api/productos/<id>/` | Tambien sirve para solo `{"disponible": ...}`. |
| `DELETE` | `/api/productos/<id>/` | Eliminacion (archiva, ver abajo). |
| `GET` | `/api/categorias/` | Categorias para el selector (sin paginar). |

Renombrar un producto **no** le cambia el `slug`: es su direccion publica y
moverla romperia los enlaces que ya circulan. Para cambiarlo hay que enviarlo
a proposito.

### Agotado no es eliminado

Son dos cosas distintas y conviene no confundirlas:

- **`disponible`** dice si hay existencias hoy. Un producto agotado **sigue en
  el catalogo**, marcado y ordenado al final. Es reversible con un clic.
- **`archivado`** saca el producto del catalogo por completo (ver abajo).

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

> **Solo personal.** Dar de alta, modificar y eliminar productos requiere un
> usuario con `is_staff` (FR-19). El listado y la ficha siguen siendo
> publicos.

---

## Panel administrativo (FR-19)

Punto de entrada para el personal: <http://localhost:4200/admin>. El enlace
*Administrar* del encabezado solo aparece con sesion de personal iniciada; sin
eso, entrar a cualquier `/admin/*` redirige al login.

Para crear un usuario de personal (no hay pantalla para esto, es deliberado):

```bash
docker compose exec backend python manage.py createsuperuser
```

O marcar `is_staff` a un usuario que ya se registro, desde
<http://localhost:8001/admin/> &rarr; Usuarios.

### Pedidos

- Listado, con filtro por estado: <http://localhost:4200/admin/pedidos>
- Detalle de un pedido: `/admin/pedidos/<id>` (boton *Ver* de cada fila), con
  los datos de entrega, el pago y los productos
- Confirmar el pago: boton *Marcar como pagado* en el detalle (equivale a la
  accion del admin de Django)

| Metodo | Ruta | Para que |
|---|---|---|
| `GET` | `/api/pedidos/admin/` | Listado paginado. Admite `?estado=` y `?page=`. |
| `GET` | `/api/pedidos/admin/<id>/` | Detalle completo. |
| `POST` | `/api/pedidos/admin/<id>/marcar-pagado/` | Pasa el pedido y su pago a pagado/aprobado. |

### Usuarios

- Listado: <http://localhost:4200/admin/usuarios>
- Activar o desactivar una cuenta: etiqueta *Activo* / *Inactivo* de cada
  fila, es un boton. Una cuenta inactiva no puede iniciar sesion.

Solo se puede cambiar `is_active` desde aqui. Para marcar o quitar personal
(`is_staff`) o editar otros datos de la cuenta hay que ir al admin de Django:
el panel no toca esos campos a proposito.

| Metodo | Ruta | Para que |
|---|---|---|
| `GET` | `/api/auth/usuarios/` | Listado paginado de clientes registrados. |
| `PATCH` | `/api/auth/usuarios/<id>/` | Solo admite `{"is_active": ...}`. |

### Inventario

Hoy "inventario" es el mismo booleano Disponible/Agotado de FR-09: el negocio
no maneja cantidades por producto. Se gestiona desde el listado de productos
de arriba, no hay una pantalla aparte.
