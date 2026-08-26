from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.accounts.models import Direccion
from apps.orders.models import Pedido
from apps.orders.services import crear_pedido_desde_carrito

pytestmark = pytest.mark.django_db


def _agregar_al_carrito(api, producto, cantidad="2.000"):
    return api.post(
        "/api/carrito/items/",
        {"producto": producto.id, "cantidad": cantidad},
        format="json",
    )


def test_el_carrito_arranca_vacio(api_cliente):
    respuesta = api_cliente.get("/api/carrito/")
    assert respuesta.status_code == 200
    assert respuesta.data["items"] == []


def test_agregar_producto_al_carrito(api_cliente, producto):
    assert _agregar_al_carrito(api_cliente, producto).status_code == 201

    carrito = api_cliente.get("/api/carrito/").data
    assert len(carrito["items"]) == 1
    assert Decimal(carrito["subtotal"]) == Decimal("104000.00")


def test_agregar_dos_veces_suma_en_vez_de_fallar(api_cliente, producto):
    _agregar_al_carrito(api_cliente, producto, "2.000")
    _agregar_al_carrito(api_cliente, producto, "3.000")

    carrito = api_cliente.get("/api/carrito/").data
    assert len(carrito["items"]) == 1
    assert Decimal(carrito["items"][0]["cantidad"]) == Decimal("5.000")


def test_no_se_puede_agregar_mas_de_lo_que_hay(api_cliente, producto):
    respuesta = _agregar_al_carrito(api_cliente, producto, "999.000")
    assert respuesta.status_code == 400


def test_vaciar_carrito(api_cliente, producto):
    _agregar_al_carrito(api_cliente, producto)
    assert api_cliente.delete("/api/carrito/").status_code == 204
    assert api_cliente.get("/api/carrito/").data["items"] == []


def test_el_carrito_requiere_sesion(api):
    assert api.get("/api/carrito/").status_code == 403


def test_crear_pedido_congela_los_precios(api_cliente, producto, direccion, cliente):
    _agregar_al_carrito(api_cliente, producto, "2.000")

    respuesta = api_cliente.post(
        "/api/pedidos/", {"direccion": direccion.id}, format="json"
    )
    assert respuesta.status_code == 201
    pedido_id = respuesta.data["id"]

    # El precio sube despues de comprar.
    producto.precio = Decimal("99000.00")
    producto.save()

    pedido = api_cliente.get(f"/api/pedidos/{pedido_id}/").data
    assert Decimal(pedido["items"][0]["precio_unitario"]) == Decimal("52000.00")
    assert Decimal(pedido["subtotal"]) == Decimal("104000.00")
    # Subtotal + domicilio.
    assert Decimal(pedido["total"]) == Decimal("112000.00")
    assert pedido["estado"] == Pedido.Estado.PENDIENTE_PAGO


def test_no_se_puede_crear_un_pedido_con_el_carrito_vacio(api_cliente, direccion):
    respuesta = api_cliente.post(
        "/api/pedidos/", {"direccion": direccion.id}, format="json"
    )
    assert respuesta.status_code == 400


def test_no_se_despacha_fuera_de_la_zona_de_cobertura(api_cliente, producto, cliente):
    fuera = Direccion.objects.create(
        usuario=cliente,
        etiqueta="Finca",
        ciudad="Cartagena",
        direccion="Cra 1 #2-3",
        en_zona_cobertura=False,
    )
    _agregar_al_carrito(api_cliente, producto)

    with pytest.raises(ValidationError):
        crear_pedido_desde_carrito(cliente, fuera)


def test_no_se_puede_usar_la_direccion_de_otro(api_cliente, producto, staff):
    ajena = Direccion.objects.create(
        usuario=staff, etiqueta="Casa", ciudad="Medellin", direccion="Otra"
    )
    _agregar_al_carrito(api_cliente, producto)

    respuesta = api_cliente.post("/api/pedidos/", {"direccion": ajena.id}, format="json")
    assert respuesta.status_code == 400


def test_el_cliente_solo_ve_sus_pedidos(api_cliente, api, producto, direccion, staff):
    _agregar_al_carrito(api_cliente, producto)
    api_cliente.post("/api/pedidos/", {"direccion": direccion.id}, format="json")

    api.force_authenticate(user=staff)
    # El staff ve todos los pedidos: es el panel del mostrador.
    assert api.get("/api/pedidos/").data["count"] == 1


def test_el_staff_no_puede_marcar_pagado_a_mano(api_cliente, api_staff, producto, direccion):
    _agregar_al_carrito(api_cliente, producto)
    pedido_id = api_cliente.post(
        "/api/pedidos/", {"direccion": direccion.id}, format="json"
    ).data["id"]

    respuesta = api_staff.patch(
        f"/api/pedidos/{pedido_id}/estado/", {"estado": "PAGADO"}, format="json"
    )
    assert respuesta.status_code == 400


def test_no_se_prepara_un_pedido_sin_pagar(api_cliente, api_staff, producto, direccion):
    _agregar_al_carrito(api_cliente, producto)
    pedido_id = api_cliente.post(
        "/api/pedidos/", {"direccion": direccion.id}, format="json"
    ).data["id"]

    respuesta = api_staff.patch(
        f"/api/pedidos/{pedido_id}/estado/", {"estado": "EN_PREPARACION"}, format="json"
    )
    assert respuesta.status_code == 400


def test_el_staff_avanza_el_estado_de_un_pedido_pagado(
    api_cliente, api_staff, producto, direccion
):
    """FR-12."""
    _agregar_al_carrito(api_cliente, producto)
    pedido_id = api_cliente.post(
        "/api/pedidos/", {"direccion": direccion.id}, format="json"
    ).data["id"]

    Pedido.objects.filter(pk=pedido_id).update(estado=Pedido.Estado.PAGADO)

    for estado in ["EN_PREPARACION", "ENVIADO", "ENTREGADO"]:
        respuesta = api_staff.patch(
            f"/api/pedidos/{pedido_id}/estado/", {"estado": estado}, format="json"
        )
        assert respuesta.status_code == 200
        assert respuesta.data["estado"] == estado


def test_un_cliente_no_puede_cambiar_estados(api_cliente, producto, direccion):
    _agregar_al_carrito(api_cliente, producto)
    pedido_id = api_cliente.post(
        "/api/pedidos/", {"direccion": direccion.id}, format="json"
    ).data["id"]

    respuesta = api_cliente.patch(
        f"/api/pedidos/{pedido_id}/estado/", {"estado": "ENTREGADO"}, format="json"
    )
    assert respuesta.status_code == 403
