from decimal import Decimal

import pytest

from apps.accounts.models import Usuario
from apps.catalog.models import Categoria, Producto
from apps.pedidos.models import ItemPedido, Pago, Pedido


@pytest.fixture
def cliente(db):
    return Usuario.objects.create_user(email="ana@example.com", password="UnaClaveSegura123")


@pytest.fixture
def staff(db):
    return Usuario.objects.create_user(
        email="staff@carneseus.test", password="UnaClaveSegura123", is_staff=True
    )


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre="Res", slug="res")


@pytest.fixture
def producto(categoria):
    return Producto.objects.create(
        categoria=categoria,
        nombre="Lomo fino",
        slug="lomo-fino",
        presentacion="Bandeja 500 g",
        precio=Decimal("38900.00"),
    )


@pytest.fixture
def pedido(producto):
    pedido = Pedido.objects.create(
        nombre="Ana Gomez",
        email="ana@example.com",
        telefono="3001234567",
        direccion="Cra 70 # 45-10",
        municipio="Medellin",
        barrio="Laureles",
        estado=Pedido.Estado.POR_CONFIRMAR,
        total=producto.precio,
    )
    ItemPedido.objects.create(
        pedido=pedido,
        producto=producto,
        nombre=producto.nombre,
        precio_unitario=producto.precio,
        cantidad=1,
    )
    Pago.objects.create(pedido=pedido, metodo=Pago.Metodo.TRANSFERENCIA, monto=producto.precio)
    return pedido


# --- el panel de productos ya no esta abierto a cualquiera --------------------


@pytest.mark.django_db
def test_crear_producto_rechaza_a_un_anonimo(api, categoria):
    respuesta = api.post(
        "/api/productos/",
        {"categoria": categoria.id, "nombre": "Lomo", "presentacion": "500 g", "precio": "1000"},
        format="json",
    )

    assert respuesta.status_code in (401, 403)
    assert Producto.objects.count() == 0


@pytest.mark.django_db
def test_crear_producto_rechaza_a_un_cliente_sin_permisos(api, cliente, categoria):
    api.force_authenticate(cliente)

    respuesta = api.post(
        "/api/productos/",
        {"categoria": categoria.id, "nombre": "Lomo", "presentacion": "500 g", "precio": "1000"},
        format="json",
    )

    assert respuesta.status_code == 403
    assert Producto.objects.count() == 0


@pytest.mark.django_db
def test_modificar_producto_rechaza_a_un_cliente(api, cliente, producto):
    api.force_authenticate(cliente)

    respuesta = api.patch(f"/api/productos/{producto.id}/", {"precio": "1"}, format="json")

    assert respuesta.status_code == 403
    producto.refresh_from_db()
    assert producto.precio == Decimal("38900.00")


@pytest.mark.django_db
def test_eliminar_producto_rechaza_a_un_cliente(api, cliente, producto):
    api.force_authenticate(cliente)

    respuesta = api.delete(f"/api/productos/{producto.id}/")

    assert respuesta.status_code == 403
    producto.refresh_from_db()
    assert producto.archivado is False


@pytest.mark.django_db
def test_el_catalogo_publico_sigue_sin_sesion(api, producto):
    assert api.get("/api/productos/").status_code == 200
    assert api.get(f"/api/productos/{producto.slug}/").status_code == 200


# --- listado y detalle de pedidos ---------------------------------------------


@pytest.mark.django_db
def test_listado_de_pedidos_rechaza_a_un_cliente(api, cliente, pedido):
    api.force_authenticate(cliente)

    assert api.get("/api/pedidos/admin/").status_code == 403


@pytest.mark.django_db
def test_listado_de_pedidos_para_personal(api, staff, pedido):
    api.force_authenticate(staff)

    respuesta = api.get("/api/pedidos/admin/")

    assert respuesta.status_code == 200
    assert respuesta.data["count"] == 1
    fila = respuesta.data["results"][0]
    assert fila["nombre"] == "Ana Gomez"
    assert fila["estado"] == "por_confirmar"
    assert fila["metodo_pago"] == "Transferencia"


@pytest.mark.django_db
def test_listado_de_pedidos_filtra_por_estado(api, staff, pedido, producto):
    otro = Pedido.objects.create(
        nombre="Otro",
        email="otro@example.com",
        telefono="300",
        direccion="x",
        municipio="x",
        barrio="x",
        estado=Pedido.Estado.PAGADO,
        total=producto.precio,
    )
    Pago.objects.create(pedido=otro, metodo=Pago.Metodo.CONTRAENTREGA_QR, monto=producto.precio)
    api.force_authenticate(staff)

    respuesta = api.get("/api/pedidos/admin/", {"estado": "pagado"})

    assert respuesta.data["count"] == 1
    assert respuesta.data["results"][0]["nombre"] == "Otro"


@pytest.mark.django_db
def test_detalle_de_pedido_rechaza_a_un_cliente(api, cliente, pedido):
    api.force_authenticate(cliente)

    assert api.get(f"/api/pedidos/admin/{pedido.id}/").status_code == 403


@pytest.mark.django_db
def test_detalle_de_pedido_para_personal(api, staff, pedido):
    api.force_authenticate(staff)

    respuesta = api.get(f"/api/pedidos/admin/{pedido.id}/")

    assert respuesta.status_code == 200
    assert respuesta.data["items"][0]["nombre"] == "Lomo fino"
    assert respuesta.data["pago"]["metodo"] == "transferencia"


# --- marcar un pedido como pagado ----------------------------------------------


@pytest.mark.django_db
def test_marcar_pagado_rechaza_a_un_cliente(api, cliente, pedido):
    api.force_authenticate(cliente)

    respuesta = api.post(f"/api/pedidos/admin/{pedido.id}/marcar-pagado/")

    assert respuesta.status_code == 403
    pedido.refresh_from_db()
    assert pedido.estado == Pedido.Estado.POR_CONFIRMAR


@pytest.mark.django_db
def test_marcar_pagado_para_personal(api, staff, pedido):
    api.force_authenticate(staff)

    respuesta = api.post(f"/api/pedidos/admin/{pedido.id}/marcar-pagado/")

    assert respuesta.status_code == 200
    assert respuesta.data["estado"] == "pagado"
    pedido.refresh_from_db()
    assert pedido.estado == Pedido.Estado.PAGADO
    assert pedido.pago.estado == Pago.Estado.APROBADO


@pytest.mark.django_db
def test_marcar_pagado_de_un_pedido_inexistente_responde_404(api, staff):
    api.force_authenticate(staff)

    assert api.post("/api/pedidos/admin/9999/marcar-pagado/").status_code == 404


# --- listado y activacion de usuarios -------------------------------------------


@pytest.mark.django_db
def test_listado_de_usuarios_rechaza_a_un_cliente(api, cliente):
    api.force_authenticate(cliente)

    assert api.get("/api/auth/usuarios/").status_code == 403


@pytest.mark.django_db
def test_listado_de_usuarios_para_personal(api, staff, cliente):
    api.force_authenticate(staff)

    respuesta = api.get("/api/auth/usuarios/")

    assert respuesta.status_code == 200
    correos = {usuario["email"] for usuario in respuesta.data["results"]}
    assert {"ana@example.com", "staff@carneseus.test"} <= correos


@pytest.mark.django_db
def test_desactivar_un_usuario(api, staff, cliente):
    api.force_authenticate(staff)

    respuesta = api.patch(f"/api/auth/usuarios/{cliente.id}/", {"is_active": False}, format="json")

    assert respuesta.status_code == 200
    cliente.refresh_from_db()
    assert cliente.is_active is False


@pytest.mark.django_db
def test_un_usuario_desactivado_no_puede_iniciar_sesion(api, staff, cliente):
    api.force_authenticate(staff)
    api.patch(f"/api/auth/usuarios/{cliente.id}/", {"is_active": False}, format="json")
    api.force_authenticate(None)

    respuesta = api.post(
        "/api/auth/login/", {"email": "ana@example.com", "password": "UnaClaveSegura123"}
    )

    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_desactivar_no_permite_cambiar_otros_campos(api, staff, cliente):
    api.force_authenticate(staff)

    api.patch(
        f"/api/auth/usuarios/{cliente.id}/",
        {"is_active": False, "email": "otro@example.com", "is_staff": True},
        format="json",
    )

    cliente.refresh_from_db()
    assert cliente.email == "ana@example.com"
    assert cliente.is_staff is False


@pytest.mark.django_db
def test_cambiar_estado_de_usuario_rechaza_a_un_cliente(api, cliente):
    otro = Usuario.objects.create_user(email="otro@example.com", password="UnaClaveSegura123")
    api.force_authenticate(cliente)

    respuesta = api.patch(f"/api/auth/usuarios/{otro.id}/", {"is_active": False}, format="json")

    assert respuesta.status_code == 403
    otro.refresh_from_db()
    assert otro.is_active is True
