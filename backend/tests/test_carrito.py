from decimal import Decimal

import pytest

from apps.cart.models import Carrito
from apps.catalog.models import Categoria, Producto


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
def otro_producto(categoria):
    return Producto.objects.create(
        categoria=categoria,
        nombre="Churrasco",
        slug="churrasco",
        presentacion="Bandeja 400 g",
        precio=Decimal("29900.00"),
    )


def agregar(api, producto, cantidad=1, token=None):
    cabeceras = {"HTTP_X_CARRITO_TOKEN": token} if token else {}
    return api.post(
        "/api/carrito/items/",
        {"producto": producto.id, "cantidad": cantidad},
        format="json",
        **cabeceras,
    )


@pytest.mark.django_db
def test_el_carrito_arranca_vacio_y_entrega_token(api):
    respuesta = api.get("/api/carrito/")

    assert respuesta.status_code == 200
    assert respuesta.data["items"] == []
    assert Decimal(respuesta.data["total"]) == Decimal("0")
    assert respuesta.data["token"]


@pytest.mark.django_db
def test_agrega_un_producto_al_carrito(api, producto):
    respuesta = agregar(api, producto, cantidad=2)

    assert respuesta.status_code == 201
    assert len(respuesta.data["items"]) == 1
    assert respuesta.data["items"][0]["nombre"] == "Lomo fino"
    assert respuesta.data["items"][0]["cantidad"] == 2


@pytest.mark.django_db
def test_agregar_dos_veces_suma_la_cantidad_sin_repetir_la_linea(api, producto):
    token = agregar(api, producto, cantidad=1).data["token"]
    respuesta = agregar(api, producto, cantidad=3, token=token)

    assert len(respuesta.data["items"]) == 1
    assert respuesta.data["items"][0]["cantidad"] == 4


@pytest.mark.django_db
def test_el_total_suma_los_subtotales(api, producto, otro_producto):
    token = agregar(api, producto, cantidad=2).data["token"]
    respuesta = agregar(api, otro_producto, cantidad=1, token=token)

    # 2 x 38900 + 1 x 29900
    assert Decimal(respuesta.data["total"]) == Decimal("107700.00")
    assert respuesta.data["cantidad_items"] == 3


@pytest.mark.django_db
def test_cambiar_la_cantidad_actualiza_el_total(api, producto):
    creado = agregar(api, producto, cantidad=1)
    token = creado.data["token"]
    item_id = creado.data["items"][0]["id"]

    respuesta = api.patch(
        f"/api/carrito/items/{item_id}/",
        {"cantidad": 3},
        format="json",
        HTTP_X_CARRITO_TOKEN=token,
    )

    assert respuesta.status_code == 200
    assert Decimal(respuesta.data["total"]) == Decimal("116700.00")


@pytest.mark.django_db
def test_quitar_un_producto_lo_saca_del_carrito(api, producto):
    creado = agregar(api, producto, cantidad=1)
    token = creado.data["token"]
    item_id = creado.data["items"][0]["id"]

    respuesta = api.delete(f"/api/carrito/items/{item_id}/", HTTP_X_CARRITO_TOKEN=token)

    assert respuesta.status_code == 200
    assert respuesta.data["items"] == []
    assert Decimal(respuesta.data["total"]) == Decimal("0")


@pytest.mark.django_db
def test_el_token_recupera_el_mismo_carrito(api, producto):
    token = agregar(api, producto).data["token"]

    respuesta = api.get("/api/carrito/", HTTP_X_CARRITO_TOKEN=token)

    assert len(respuesta.data["items"]) == 1


@pytest.mark.django_db
def test_sin_token_el_carrito_es_otro(api, producto):
    agregar(api, producto)

    respuesta = api.get("/api/carrito/")

    assert respuesta.data["items"] == []


@pytest.mark.django_db
def test_no_deja_agregar_un_producto_agotado(api, producto):
    producto.disponible = False
    producto.save(update_fields=["disponible"])

    respuesta = agregar(api, producto)

    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_no_deja_agregar_un_producto_archivado(api, producto):
    producto.archivado = True
    producto.save(update_fields=["archivado"])

    respuesta = agregar(api, producto)

    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_un_producto_agotado_despues_sigue_visible_pero_no_suma(api, producto):
    creado = agregar(api, producto, cantidad=2)
    token = creado.data["token"]

    producto.disponible = False
    producto.save(update_fields=["disponible"])

    respuesta = api.get("/api/carrito/", HTTP_X_CARRITO_TOKEN=token)
    item = respuesta.data["items"][0]

    assert item["comprable"] is False
    assert Decimal(item["subtotal"]) == Decimal("0")
    assert Decimal(respuesta.data["total"]) == Decimal("0")


@pytest.mark.django_db
def test_no_se_puede_tocar_el_item_de_otro_carrito(api, producto):
    creado = agregar(api, producto)
    item_id = creado.data["items"][0]["id"]
    otro_token = api.get("/api/carrito/").data["token"]

    respuesta = api.delete(
        f"/api/carrito/items/{item_id}/", HTTP_X_CARRITO_TOKEN=otro_token
    )

    assert respuesta.status_code == 404


@pytest.mark.django_db
def test_la_cantidad_no_puede_ser_cero(api, producto):
    creado = agregar(api, producto)
    token = creado.data["token"]
    item_id = creado.data["items"][0]["id"]

    respuesta = api.patch(
        f"/api/carrito/items/{item_id}/",
        {"cantidad": 0},
        format="json",
        HTTP_X_CARRITO_TOKEN=token,
    )

    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_fusionar_suma_las_cantidades_de_los_dos_carritos(producto, otro_producto):
    uno = Carrito.objects.create()
    uno.items.create(producto=producto, cantidad=1)
    dos = Carrito.objects.create()
    dos.items.create(producto=producto, cantidad=2)
    dos.items.create(producto=otro_producto, cantidad=1)

    uno.fusionar_con(dos)

    assert uno.items.count() == 2
    assert uno.items.get(producto=producto).cantidad == 3
    assert not Carrito.objects.filter(pk=dos.pk).exists()