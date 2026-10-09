from decimal import Decimal

import pytest

from apps.accounts.models import Usuario
from apps.catalog.models import Categoria, Producto
from apps.pedidos.admin import marcar_como_pagados
from apps.pedidos.models import Pago, Pedido


@pytest.fixture
def producto(db):
    categoria = Categoria.objects.create(nombre="Res", slug="res")
    return Producto.objects.create(
        categoria=categoria,
        nombre="Lomo fino",
        slug="lomo-fino",
        presentacion="Bandeja 500 g",
        precio=Decimal("38900.00"),
    )


@pytest.fixture
def token(api, producto):
    """Token de un carrito con 2 lomos."""
    respuesta = api.post(
        "/api/carrito/items/", {"producto": producto.id, "cantidad": 2}, format="json"
    )
    return respuesta.data["token"]


def datos_pedido(metodo="transferencia", **cambios):
    datos = {
        "metodo_pago": metodo,
        "nombre": "Ana Gomez",
        "email": "ana@example.com",
        "telefono": "3001234567",
        "direccion": "Cra 70 # 45-10",
        "municipio": "Medellin",
        "barrio": "Laureles",
    }
    return {**datos, **cambios}


def comprar(api, token, datos):
    return api.post("/api/pedidos/", datos, format="json", HTTP_X_CARRITO_TOKEN=token)


# --- los tres metodos de pago ------------------------------------------------


@pytest.mark.django_db
def test_transferencia_deja_el_pedido_por_confirmar_y_da_los_datos_de_la_cuenta(api, token):
    respuesta = comprar(api, token, datos_pedido("transferencia"))

    assert respuesta.status_code == 201
    assert respuesta.data["estado"] == "por_confirmar"
    assert Decimal(respuesta.data["total"]) == Decimal("77800.00")
    assert respuesta.data["pago"]["metodo"] == "transferencia"
    cuenta = respuesta.data["instrucciones_pago"]
    assert cuenta["banco"]
    assert cuenta["numero_cuenta"]


@pytest.mark.django_db
@pytest.mark.parametrize("metodo", ["contraentrega_qr", "contraentrega_datafono"])
def test_contraentrega_deja_el_pedido_por_cobrar_sin_datos_de_cuenta(api, token, metodo):
    respuesta = comprar(api, token, datos_pedido(metodo))

    assert respuesta.status_code == 201
    assert respuesta.data["estado"] == "por_cobrar"
    assert respuesta.data["pago"]["metodo"] == metodo
    assert respuesta.data["instrucciones_pago"] is None


@pytest.mark.django_db
@pytest.mark.parametrize(
    "metodo", ["transferencia", "contraentrega_qr", "contraentrega_datafono"]
)
def test_el_pago_nace_pendiente(api, token, metodo):
    comprar(api, token, datos_pedido(metodo))

    assert Pago.objects.get().estado == Pago.Estado.PENDIENTE


@pytest.mark.django_db
@pytest.mark.parametrize("metodo", ["cheque", "tarjeta_credito", ""])
def test_solo_se_aceptan_los_tres_metodos(api, token, metodo):
    respuesta = comprar(api, token, datos_pedido(metodo))

    assert respuesta.status_code == 400
    assert Pedido.objects.count() == 0


# --- efecto sobre el carrito y los precios -----------------------------------


@pytest.mark.django_db
def test_comprar_vacia_el_carrito(api, token):
    comprar(api, token, datos_pedido())

    carrito = api.get("/api/carrito/", HTTP_X_CARRITO_TOKEN=token)
    assert carrito.data["items"] == []


@pytest.mark.django_db
def test_el_pedido_congela_el_precio(api, token, producto):
    comprar(api, token, datos_pedido())

    producto.precio = Decimal("50000.00")
    producto.save(update_fields=["precio"])

    item = Pedido.objects.get().items.get()
    assert item.precio_unitario == Decimal("38900.00")
    assert item.nombre == "Lomo fino"


@pytest.mark.django_db
def test_un_producto_agotado_no_se_cobra_y_sigue_en_el_carrito(api, token, producto):
    agotado = Producto.objects.create(
        categoria=producto.categoria,
        nombre="Costilla",
        slug="costilla",
        presentacion="1 kg",
        precio=Decimal("20000.00"),
    )
    api.post(
        "/api/carrito/items/",
        {"producto": agotado.id, "cantidad": 1},
        format="json",
        HTTP_X_CARRITO_TOKEN=token,
    )
    agotado.disponible = False
    agotado.save(update_fields=["disponible"])

    respuesta = comprar(api, token, datos_pedido())

    assert Decimal(respuesta.data["total"]) == Decimal("77800.00")
    restante = api.get("/api/carrito/", HTTP_X_CARRITO_TOKEN=token)
    assert [item["nombre"] for item in restante.data["items"]] == ["Costilla"]


# --- errores -------------------------------------------------------------------


@pytest.mark.django_db
def test_carrito_vacio_no_se_puede_comprar(api):
    token_vacio = api.get("/api/carrito/").data["token"]

    respuesta = comprar(api, token_vacio, datos_pedido())

    assert respuesta.status_code == 400
    assert Pedido.objects.count() == 0


@pytest.mark.django_db
def test_sin_carrito_no_se_puede_comprar(api):
    assert api.post("/api/pedidos/", datos_pedido(), format="json").status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize(
    "campo", ["nombre", "email", "telefono", "direccion", "municipio", "barrio"]
)
def test_los_datos_de_entrega_son_obligatorios(api, token, campo):
    datos = datos_pedido()
    del datos[campo]

    assert comprar(api, token, datos).status_code == 400


# --- usuario con sesion y admin ------------------------------------------------


@pytest.mark.django_db
def test_con_sesion_el_pedido_queda_a_nombre_del_usuario(api, producto):
    usuario = Usuario.objects.create_user(email="ana@example.com", password="UnaClaveSegura123")
    api.force_authenticate(usuario)
    api.post("/api/carrito/items/", {"producto": producto.id, "cantidad": 1}, format="json")

    respuesta = api.post("/api/pedidos/", datos_pedido("contraentrega_qr"), format="json")

    assert respuesta.status_code == 201
    assert Pedido.objects.get().usuario == usuario


@pytest.mark.django_db
def test_la_accion_del_admin_marca_pedido_y_pago_como_pagados(api, token):
    comprar(api, token, datos_pedido())

    marcar_como_pagados(None, None, Pedido.objects.all())

    assert Pedido.objects.get().estado == Pedido.Estado.PAGADO
    assert Pago.objects.get().estado == Pago.Estado.APROBADO
