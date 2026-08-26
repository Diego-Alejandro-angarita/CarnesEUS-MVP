"""
Todo lo que habla con Wompi vive aqui.

Ningun otro modulo importa esta pasarela: si manana toca cambiar de proveedor,
se toca esta carpeta y nada mas.
"""

import logging
import uuid
from decimal import ROUND_HALF_UP, Decimal

import requests
from django.conf import settings
from django.db import transaction
from django.db.models import F

from apps.catalog.models import Producto
from apps.orders.models import Pedido

from .models import Pago
from .signatures import firma_integridad

logger = logging.getLogger(__name__)

TIMEOUT = 15


class WompiNoConfigurado(Exception):
    """Faltan las llaves de Wompi en el .env."""


class WompiError(Exception):
    """Wompi respondio algo inesperado."""


def wompi_esta_configurado():
    return bool(settings.WOMPI_PUBLIC_KEY and settings.WOMPI_INTEGRITY_SECRET)


def a_centavos(monto):
    """
    Convierte un monto en pesos al formato que espera Wompi.

    Wompi trabaja en centavos: $9.500 COP se envian como 950000. Esta funcion
    es el unico lugar donde se multiplica por 100; repartir esa operacion por
    el codigo es la via rapida a un descuadre contable.
    """
    if not isinstance(monto, Decimal):
        monto = Decimal(str(monto))
    centavos = (monto * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(centavos)


def generar_referencia(pedido):
    """
    Referencia unica por intento de pago.

    Lleva el numero del pedido para poder rastrearla desde el panel de Wompi,
    y un sufijo aleatorio porque Wompi rechaza referencias repetidas: un
    reintento tras un rechazo necesita una nueva.
    """
    return f"{pedido.numero}-{uuid.uuid4().hex[:8].upper()}"


@transaction.atomic
def crear_intento_de_pago(pedido):
    """Registra un intento de pago y devuelve los datos que necesita el Widget."""
    if not wompi_esta_configurado():
        raise WompiNoConfigurado(
            "Faltan WOMPI_PUBLIC_KEY y WOMPI_INTEGRITY_SECRET en el archivo .env."
        )

    monto_en_centavos = a_centavos(pedido.total)
    pago = Pago.objects.create(
        pedido=pedido,
        referencia=generar_referencia(pedido),
        monto_en_centavos=monto_en_centavos,
        moneda=settings.WOMPI_MONEDA,
    )

    firma = firma_integridad(
        referencia=pago.referencia,
        monto_en_centavos=pago.monto_en_centavos,
        moneda=pago.moneda,
        secreto=settings.WOMPI_INTEGRITY_SECRET,
    )

    logger.info("Intento de pago creado ref=%s pedido=%s", pago.referencia, pedido.numero)

    return {
        # La llave publica la entrega el backend: cambiar de sandbox a
        # produccion es cambiar un .env, no recompilar Angular.
        "publicKey": settings.WOMPI_PUBLIC_KEY,
        "currency": pago.moneda,
        "amountInCents": pago.monto_en_centavos,
        "reference": pago.referencia,
        "signature": firma,
        "redirectUrl": f"{settings.FRONTEND_URL}/pedidos/{pedido.id}",
        "customerData": {
            "email": pedido.usuario.email,
            "fullName": pedido.usuario.nombre_completo,
            "phoneNumber": pedido.usuario.telefono,
            "phoneNumberPrefix": "+57",
        },
        "shippingAddress": {
            "addressLine1": pedido.direccion_texto,
            "city": pedido.direccion.ciudad if pedido.direccion else "",
            "phoneNumber": pedido.usuario.telefono,
            "region": "Antioquia",
            "country": "CO",
        },
    }


def consultar_transaccion(transaction_id):
    """Consulta activa a Wompi. Es la fuente de verdad, no el navegador."""
    url = f"{settings.WOMPI_BASE_URL}/transactions/{transaction_id}"
    cabeceras = {"Authorization": f"Bearer {settings.WOMPI_PRIVATE_KEY}"}
    try:
        respuesta = requests.get(url, headers=cabeceras, timeout=TIMEOUT)
    except requests.RequestException as exc:
        raise WompiError(f"No se pudo contactar a Wompi: {exc}") from exc

    if respuesta.status_code == 404:
        raise WompiError("La transaccion no existe en Wompi.")
    if respuesta.status_code >= 400:
        raise WompiError(f"Wompi respondio {respuesta.status_code}: {respuesta.text[:200]}")

    return respuesta.json().get("data", {})


@transaction.atomic
def aplicar_transaccion(datos_transaccion):
    """
    Traslada el estado de una transaccion de Wompi al pedido.

    Es la unica implementacion de esas reglas: la usan tanto el webhook como
    la verificacion activa, para que no puedan divergir.
    """
    referencia = datos_transaccion.get("reference")
    pago = Pago.objects.select_for_update().filter(referencia=referencia).first()
    if pago is None:
        logger.warning("Transaccion de Wompi con referencia desconocida: %s", referencia)
        return None

    monto_recibido = int(datos_transaccion.get("amount_in_cents") or 0)
    if monto_recibido != pago.monto_en_centavos:
        # El monto no coincide con lo que cobramos: no se aprueba nada.
        logger.error(
            "Monto no coincide ref=%s esperado=%s recibido=%s",
            referencia,
            pago.monto_en_centavos,
            monto_recibido,
        )
        pago.estado = Pago.Estado.ERROR
        pago.raw_response = datos_transaccion
        pago.save(update_fields=["estado", "raw_response", "actualizado_en"])
        return pago

    estado_wompi = datos_transaccion.get("status", "")
    pago.estado = Pago.MAPA_ESTADOS_WOMPI.get(estado_wompi, Pago.Estado.ERROR)
    pago.wompi_transaction_id = datos_transaccion.get("id") or pago.wompi_transaction_id
    pago.metodo_pago = datos_transaccion.get("payment_method_type") or pago.metodo_pago
    pago.raw_response = datos_transaccion
    pago.save(
        update_fields=[
            "estado",
            "wompi_transaction_id",
            "metodo_pago",
            "raw_response",
            "actualizado_en",
        ]
    )

    if pago.estado == Pago.Estado.APROBADO:
        _marcar_pedido_pagado(pago.pedido)

    logger.info("Pago %s -> %s (pedido %s)", pago.referencia, pago.estado, pago.pedido.numero)
    return pago


def _marcar_pedido_pagado(pedido):
    """Promueve el pedido a PAGADO y descuenta el stock. Idempotente."""
    pedido = Pedido.objects.select_for_update().get(pk=pedido.pk)
    if pedido.estado != Pedido.Estado.PENDIENTE_PAGO:
        # Ya se proceso (reintento del webhook o verificacion duplicada):
        # descontar stock otra vez seria un error de inventario.
        return pedido

    pedido.estado = Pedido.Estado.PAGADO
    pedido.save(update_fields=["estado", "actualizado_en"])

    for item in pedido.items.all():
        if not item.producto_id:
            continue
        Producto.objects.filter(pk=item.producto_id).update(stock=F("stock") - item.cantidad)
        # Si dos pedidos alcanzaron a llevarse el mismo kilo, el stock queda en
        # negativo: se corta en cero y el producto sale del catalogo para que
        # el mostrador lo revise en vez de seguir vendiendo lo que no hay.
        Producto.objects.filter(pk=item.producto_id, stock__lt=0).update(
            stock=0, disponible=False
        )

    # Aviso de cortesia; si el correo falla, el pedido ya quedo pagado.
    from apps.notifications.services import notificar_pedido_pagado

    notificar_pedido_pagado(pedido)
    return pedido
