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
- Cambiar el estado: en el detalle, las tres opciones (*Por confirmar*, *Por
  cobrar*, *Pagado*) estan siempre visibles con una frase de que significa
  cada una; se elige la que corresponda y se guarda sola, sin botones
  aparte. El pago se sincroniza solo: aprobado si el pedido queda pagado,
  pendiente en cualquier otro caso.

| Metodo | Ruta | Para que |
|---|---|---|
| `GET` | `/api/pedidos/admin/` | Listado paginado. Admite `?estado=` y `?page=`. |
| `GET` | `/api/pedidos/admin/<id>/` | Detalle completo. |
| `POST` | `/api/pedidos/admin/<id>/cambiar-estado/` | Body `{"estado": "por_confirmar" \| "por_cobrar" \| "pagado"}`. |

La etapa del pedido (recibido, en preparacion...) se maneja aparte, desde el
mismo detalle: ver [Estados del pedido](#estados-del-pedido-fr-12).

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

---

## Estados del pedido (FR-12)

Ademas de como va el **pago** (`estado`: por confirmar, por cobrar, pagado),
cada pedido tiene una **etapa** que dice en que va:

```
recibido -> en_preparacion -> en_camino -> entregado
    \______________/
      cancelado
```

Son dos campos a proposito: un pedido contraentrega se entrega antes de quedar
pagado, y uno por transferencia puede estar pagado y seguir en preparacion.

### Reglas

- Todo pedido nace **recibido**.
- Solo se avanza **un paso a la vez**; no se salta ni se retrocede.
- Se puede **cancelar** mientras este recibido o en preparacion. Una vez sale
  a entrega, ya no.
- **Entregado** y **cancelado** son finales.
- Cambiar la etapa no toca el pago.

Las reglas viven en `Pedido.etapas_siguientes()` y `Pedido.cambiar_etapa()`.
La API devuelve `etapas_siguientes` con cada pedido, asi el frontend solo
muestra los botones que se pueden usar. Desde el admin de Django la etapa es
de solo lectura para que nadie se salte las reglas.

Cada cambio queda guardado con su fecha (`CambioEtapa`). Con eso se arma el
`seguimiento` que ve el cliente. La fecha de *recibido* es la de creacion del
pedido.

### Que ve el cliente

- **Mis pedidos**: <http://localhost:4200/mis-pedidos> (enlace en la
  cabecera). Con sesion iniciada lista sus pedidos con la etapa, y cada uno
  abre su detalle en `/mis-pedidos/<id>` con la linea de tiempo.
- **Sin cuenta**: en la misma pagina se consulta con el numero de pedido y el
  correo con el que se compro. La confirmacion de compra trae un enlace que
  deja el numero ya escrito.

### Que hace el personal

En el detalle del pedido del panel (`/admin/pedidos/<id>`), la seccion
*Seguimiento del pedido* muestra la linea de tiempo y un boton para pasar al
siguiente paso. *Cancelar pedido* pide confirmar en la misma pantalla. El
listado `/admin/pedidos` tiene una columna y un filtro por etapa.

| Metodo | Ruta | Para que |
|---|---|---|
| `GET` | `/api/pedidos/mios/` | Pedidos del cliente con sesion, paginados. |
| `GET` | `/api/pedidos/mios/<id>/` | Detalle con `seguimiento`. 404 si el pedido no es suyo. |
| `POST` | `/api/pedidos/consultar/` | Publico. Body `{"numero": 15, "email": "..."}`. 404 si no coinciden. |
| `POST` | `/api/pedidos/admin/<id>/cambiar-etapa/` | Solo staff. Body `{"etapa": "en_preparacion"}`. 400 con el motivo si no se permite. |
| `GET` | `/api/pedidos/admin/?etapa=` | El listado del panel tambien filtra por etapa. |

La consulta va por `POST` para que el correo no quede en la URL ni en los
logs. Responde lo mismo si el numero no existe o si el correo no coincide, asi
no sirve para averiguar que pedidos existen.

---

## Promociones (FR-13)

Descuentos por porcentaje sobre un grupo de productos. El personal los crea
desde el panel y el catalogo muestra el precio rebajado mientras rigen.

- Listado: <http://localhost:4200/admin/promociones> (tambien desde el boton
  *Promociones* del listado de productos)
- Crear: <http://localhost:4200/admin/promociones/nueva>
- Modificar: `/admin/promociones/<id>/editar` (boton *Editar* de cada fila)
- Eliminar: boton *Eliminar* de cada fila, con confirmacion en la propia fila

Cada promocion tiene nombre, porcentaje (1 a 99), fecha de inicio y de fin, un
interruptor *activa* y al menos un producto.

Endpoints (todos exigen sesion de **staff**; sin ella responden 403):

| Metodo | Ruta | Para que |
|---|---|---|
| `GET` | `/api/promociones/` | Listado paginado, con el `estado` de hoy de cada una. |
| `POST` | `/api/promociones/` | Alta. `productos` es una lista de ids. |
| `GET` | `/api/promociones/<id>/` | Datos de una promocion. |
| `PATCH` | `/api/promociones/<id>/` | Modificacion. |
| `DELETE` | `/api/promociones/<id>/` | Borrado. Los productos vuelven a su precio. |
| `GET` | `/api/promociones/productos/` | Productos del catalogo, sin paginar, para el selector. |

### Cuando rige una promocion

Rige si esta **activa** y hoy (hora de Bogota) cae entre `fecha_inicio` y
`fecha_fin`, **ambas incluidas**. El listado lo resume en `estado`:
`vigente`, `programada` (aun no empieza), `vencida` o `inactiva`.

Si un producto esta en varias promociones vigentes a la vez, se aplica la de
**mayor porcentaje**; no se suman.

### Que ve el cliente

`GET /api/productos/` y la ficha `GET /api/productos/<slug>/` traen dos campos
nuevos: `descuento` (porcentaje) y `precio_promocion` (rebajado y redondeado a
pesos). Ambos van en `null` si el producto no tiene promocion vigente. El
catalogo y la ficha muestran el precio rebajado, el de lista tachado y una
etiqueta con el porcentaje.

El carrito todavia cobra el precio de lista: aplicar el descuento al pago le
corresponde al checkout.

### Probarlo

El panel pide una cuenta del personal: se crea como se explica en
[Panel administrativo](#panel-administrativo-fr-19) y se entra con ella desde
*Iniciar sesion*.

Las promociones tambien se pueden gestionar desde el admin de Django, en
<http://localhost:8001/admin/>.
