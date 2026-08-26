from decimal import Decimal

import pytest
import responses

from apps.orders.models import ItemPedido, Pedido
from apps.payments.models import Pago, WompiEvent
from apps.payments.services import a_centavos, aplicar_transaccion
from apps.payments.signatures import checksum_evento, firma_integridad

pytestmark = pytest.mark.django_db

PUBLICA = "pub_test_llave_publica"
PRIVADA = "prv_test_llave_privada"
INTEGRIDAD = "test_integrity_secreto"
EVENTOS = "test_events_secreto"
BASE = "https://sandbox.wompi.co/v1"


@pytest.fixture
def wompi(settings):
    settings.WOMPI_BASE_URL = BASE
    settings.WOMPI_PUBLIC_KEY = PUBLICA
    settings.WOMPI_PRIVATE_KEY = PRIVADA
    settings.WOMPI_INTEGRITY_SECRET = INTEGRIDAD
    settings.WOMPI_EVENTS_SECRET = EVENTOS
    return settings


@pytest.fixture
def pedido(cliente, direccion, producto):
    pedido = Pedido.objects.create(
        usuario=cliente,
        direccion=direccion,
        direccion_texto="Calle 33 #75-20, Laureles, Medellin",
        costo_domicilio=Decimal("8000.00"),
    )
    ItemPedido.objects.create(
        pedido=pedido,
        producto=producto,
        nombre_producto=producto.nombre,
        precio_unitario=producto.precio,
        unidad_medida=producto.unidad_medida,
        cantidad=Decimal("2.000"),
        subtotal=Decimal("104000.00"),
    )
    pedido.recalcular_totales()
    pedido.save()
    return pedido


def _evento(pago, estado="APPROVED", monto=None, secreto=EVENTOS):
    payload = {
        "event": "transaction.updated",
        "data": {
            "transaction": {
                "id": "1234-1610641025-49201",
                "status": estado,
                "amount_in_cents": monto if monto is not None else pago.monto_en_centavos,
                "reference": pago.referencia,
                "payment_method_type": "CARD",
            }
        },
        "environment": "test",
        "signature": {
            "properties": [
                "transaction.id",
                "transaction.status",
                "transaction.amount_in_cents",
            ],
            "checksum": "",
        },
        "timestamp": 1530291411,
        "sent_at": "2026-08-21T16:45:05.000Z",
    }
    payload["signature"]["checksum"] = checksum_evento(payload, secreto)
    return payload


# ---------------------------------------------------------------------------
# Conversion de moneda
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "pesos,centavos",
    [
        ("9500", 950000),
        ("112000.00", 11200000),
        ("0.01", 1),
        ("1234.56", 123456),
        # Redondeo hacia arriba en el medio centavo.
        ("0.005", 1),
    ],
)
def test_conversion_a_centavos(pesos, centavos):
    assert a_centavos(Decimal(pesos)) == centavos


def test_a_centavos_devuelve_entero():
    # Wompi rechaza montos que no sean enteros.
    assert isinstance(a_centavos(Decimal("112000.00")), int)


# ---------------------------------------------------------------------------
# Checkout
# ---------------------------------------------------------------------------


def test_checkout_sin_llaves_avisa_con_claridad(api_cliente, pedido, settings):
    settings.WOMPI_PUBLIC_KEY = ""
    settings.WOMPI_INTEGRITY_SECRET = ""

    respuesta = api_cliente.post(f"/api/pedidos/{pedido.id}/checkout/")
    assert respuesta.status_code == 503
    assert "WOMPI_PUBLIC_KEY" in respuesta.data["detail"]


def test_checkout_devuelve_los_datos_del_widget(api_cliente, pedido, wompi):
    respuesta = api_cliente.post(f"/api/pedidos/{pedido.id}/checkout/")
    assert respuesta.status_code == 200

    datos = respuesta.data
    assert datos["publicKey"] == PUBLICA
    assert datos["currency"] == "COP"
    assert datos["amountInCents"] == 11200000
    assert datos["customerData"]["email"] == pedido.usuario.email

    pago = Pago.objects.get(referencia=datos["reference"])
    assert pago.estado == Pago.Estado.PENDIENTE
    assert pago.monto_en_centavos == 11200000


def test_la_firma_del_checkout_corresponde_al_monto_real(api_cliente, pedido, wompi):
    datos = api_cliente.post(f"/api/pedidos/{pedido.id}/checkout/").data

    esperada = firma_integridad(
        datos["reference"], datos["amountInCents"], "COP", INTEGRIDAD
    )
    assert datos["signature"] == esperada


def test_el_secreto_de_integridad_nunca_viaja_al_frontend(api_cliente, pedido, wompi):
    cuerpo = str(api_cliente.post(f"/api/pedidos/{pedido.id}/checkout/").data)
    assert INTEGRIDAD not in cuerpo
    assert PRIVADA not in cuerpo


def test_cada_intento_genera_una_referencia_nueva(api_cliente, pedido, wompi):
    """Wompi rechaza referencias repetidas: un reintento necesita otra."""
    primera = api_cliente.post(f"/api/pedidos/{pedido.id}/checkout/").data["reference"]
    segunda = api_cliente.post(f"/api/pedidos/{pedido.id}/checkout/").data["reference"]

    assert primera != segunda
    assert pedido.pagos.count() == 2


def test_no_se_puede_pagar_el_pedido_de_otro(api_staff, pedido, wompi):
    assert api_staff.post(f"/api/pedidos/{pedido.id}/checkout/").status_code == 404


def test_no_se_cobra_dos_veces_un_pedido_pagado(api_cliente, pedido, wompi):
    Pedido.objects.filter(pk=pedido.pk).update(estado=Pedido.Estado.PAGADO)
    assert api_cliente.post(f"/api/pedidos/{pedido.id}/checkout/").status_code == 409


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------


def test_webhook_aprobado_marca_el_pedido_y_descuenta_stock(api, pedido, producto, wompi):
    pago = Pago.objects.create(
        pedido=pedido, referencia="CE-TEST-0001", monto_en_centavos=11200000
    )

    respuesta = api.post("/api/webhooks/wompi/", _evento(pago), format="json")
    assert respuesta.status_code == 200

    pago.refresh_from_db()
    pedido.refresh_from_db()
    producto.refresh_from_db()

    assert pago.estado == Pago.Estado.APROBADO
    assert pago.metodo_pago == "CARD"
    assert pago.wompi_transaction_id == "1234-1610641025-49201"
    assert pedido.estado == Pedido.Estado.PAGADO
    # 10 kg iniciales menos los 2 del pedido.
    assert producto.stock == Decimal("8.000")


def test_webhook_con_firma_invalida_no_hace_nada(api, pedido, producto, wompi):
    pago = Pago.objects.create(
        pedido=pedido, referencia="CE-TEST-0002", monto_en_centavos=11200000
    )
    evento = _evento(pago, estado="DECLINED")
    # Se cambia el estado despues de firmar: es el ataque que hay que frenar.
    evento["data"]["transaction"]["status"] = "APPROVED"

    respuesta = api.post("/api/webhooks/wompi/", evento, format="json")

    assert respuesta.status_code == 401
    pedido.refresh_from_db()
    producto.refresh_from_db()
    assert pedido.estado == Pedido.Estado.PENDIENTE_PAGO
    assert producto.stock == Decimal("10.000")


def test_webhook_firmado_con_otro_secreto_se_rechaza(api, pedido, wompi):
    pago = Pago.objects.create(
        pedido=pedido, referencia="CE-TEST-0003", monto_en_centavos=11200000
    )
    evento = _evento(pago, secreto="test_events_de_un_atacante")

    assert api.post("/api/webhooks/wompi/", evento, format="json").status_code == 401


def test_webhook_repetido_no_descuenta_stock_dos_veces(api, pedido, producto, wompi):
    """Wompi reintenta hasta 3 veces en 24 horas."""
    pago = Pago.objects.create(
        pedido=pedido, referencia="CE-TEST-0004", monto_en_centavos=11200000
    )
    evento = _evento(pago)

    assert api.post("/api/webhooks/wompi/", evento, format="json").status_code == 200
    assert api.post("/api/webhooks/wompi/", evento, format="json").status_code == 200

    producto.refresh_from_db()
    assert producto.stock == Decimal("8.000")
    assert WompiEvent.objects.count() == 1


def test_webhook_rechazado_deja_el_pedido_sin_pagar(api, pedido, producto, wompi):
    pago = Pago.objects.create(
        pedido=pedido, referencia="CE-TEST-0005", monto_en_centavos=11200000
    )

    api.post("/api/webhooks/wompi/", _evento(pago, estado="DECLINED"), format="json")

    pago.refresh_from_db()
    pedido.refresh_from_db()
    producto.refresh_from_db()

    assert pago.estado == Pago.Estado.RECHAZADO
    assert pedido.estado == Pedido.Estado.PENDIENTE_PAGO
    assert producto.stock == Decimal("10.000")


def test_evento_tardio_de_un_intento_rechazado_no_pisa_al_aprobado(
    api, pedido, producto, wompi
):
    """
    Justifica que los pagos sean varios por pedido y no uno solo: el rechazo
    del primer intento llega despues de que el segundo ya fue aprobado.
    """
    rechazado = Pago.objects.create(
        pedido=pedido, referencia="CE-TEST-A", monto_en_centavos=11200000
    )
    aprobado = Pago.objects.create(
        pedido=pedido, referencia="CE-TEST-B", monto_en_centavos=11200000
    )

    api.post("/api/webhooks/wompi/", _evento(aprobado), format="json")
    pedido.refresh_from_db()
    assert pedido.estado == Pedido.Estado.PAGADO

    evento_tardio = _evento(rechazado, estado="DECLINED")
    evento_tardio["data"]["transaction"]["id"] = "9999-otra-transaccion"
    evento_tardio["signature"]["checksum"] = checksum_evento(evento_tardio, EVENTOS)
    api.post("/api/webhooks/wompi/", evento_tardio, format="json")

    pedido.refresh_from_db()
    producto.refresh_from_db()
    rechazado.refresh_from_db()

    assert rechazado.estado == Pago.Estado.RECHAZADO
    # El pedido sigue pagado y el stock se descontó una sola vez.
    assert pedido.estado == Pedido.Estado.PAGADO
    assert producto.stock == Decimal("8.000")


def test_referencia_desconocida_responde_200_sin_tocar_nada(api, wompi):
    """Reintentar no cambiaria el resultado: mejor que Wompi deje de insistir."""
    fantasma = Pago(referencia="CE-NO-EXISTE", monto_en_centavos=11200000)
    respuesta = api.post("/api/webhooks/wompi/", _evento(fantasma), format="json")

    assert respuesta.status_code == 200
    assert Pago.objects.count() == 0


def test_monto_que_no_coincide_marca_error_y_no_aprueba(pedido, producto, wompi):
    pago = Pago.objects.create(
        pedido=pedido, referencia="CE-TEST-0006", monto_en_centavos=11200000
    )

    aplicar_transaccion(
        {
            "id": "tx-1",
            "status": "APPROVED",
            "amount_in_cents": 100,
            "reference": pago.referencia,
        }
    )

    pago.refresh_from_db()
    pedido.refresh_from_db()
    producto.refresh_from_db()

    assert pago.estado == Pago.Estado.ERROR
    assert pedido.estado == Pedido.Estado.PENDIENTE_PAGO
    assert producto.stock == Decimal("10.000")


# ---------------------------------------------------------------------------
# Verificacion activa (el respaldo cuando el webhook no llega)
# ---------------------------------------------------------------------------


@responses.activate
def test_verificar_pago_consulta_a_wompi_y_reconcilia(
    api_cliente, pedido, producto, wompi
):
    pago = Pago.objects.create(
        pedido=pedido, referencia="CE-TEST-0007", monto_en_centavos=11200000
    )
    responses.add(
        responses.GET,
        f"{BASE}/transactions/tx-abc",
        json={
            "data": {
                "id": "tx-abc",
                "status": "APPROVED",
                "amount_in_cents": 11200000,
                "reference": pago.referencia,
                "payment_method_type": "CARD",
            }
        },
        status=200,
    )

    respuesta = api_cliente.post(
        f"/api/pedidos/{pedido.id}/verificar-pago/",
        {"transaction_id": "tx-abc"},
        format="json",
    )

    assert respuesta.status_code == 200
    assert respuesta.data["estado_pago"] == Pago.Estado.APROBADO
    assert respuesta.data["pedido"]["estado"] == Pedido.Estado.PAGADO

    producto.refresh_from_db()
    assert producto.stock == Decimal("8.000")


@responses.activate
def test_no_se_puede_aprobar_un_pedido_con_la_transaccion_de_otro(
    api_cliente, pedido, producto, wompi
):
    """El transaction_id lo manda el navegador: hay que contrastarlo con Wompi."""
    Pago.objects.create(
        pedido=pedido, referencia="CE-TEST-0008", monto_en_centavos=11200000
    )
    responses.add(
        responses.GET,
        f"{BASE}/transactions/tx-ajena",
        json={
            "data": {
                "id": "tx-ajena",
                "status": "APPROVED",
                "amount_in_cents": 11200000,
                "reference": "CE-DE-OTRO-PEDIDO",
                "payment_method_type": "CARD",
            }
        },
        status=200,
    )

    respuesta = api_cliente.post(
        f"/api/pedidos/{pedido.id}/verificar-pago/",
        {"transaction_id": "tx-ajena"},
        format="json",
    )

    assert respuesta.status_code == 400
    pedido.refresh_from_db()
    producto.refresh_from_db()
    assert pedido.estado == Pedido.Estado.PENDIENTE_PAGO
    assert producto.stock == Decimal("10.000")


@responses.activate
def test_si_wompi_no_responde_se_informa_sin_romper(api_cliente, pedido, wompi):
    Pago.objects.create(
        pedido=pedido, referencia="CE-TEST-0009", monto_en_centavos=11200000
    )
    responses.add(responses.GET, f"{BASE}/transactions/tx-caida", status=500)

    respuesta = api_cliente.post(
        f"/api/pedidos/{pedido.id}/verificar-pago/",
        {"transaction_id": "tx-caida"},
        format="json",
    )
    assert respuesta.status_code == 502


def test_verificar_sin_transaccion_previa_avisa(api_cliente, pedido, wompi):
    respuesta = api_cliente.post(
        f"/api/pedidos/{pedido.id}/verificar-pago/", {}, format="json"
    )
    assert respuesta.status_code == 400
