import logging

from django.conf import settings
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Pedido
from apps.orders.serializers import PedidoSerializer

from .models import WompiEvent
from .serializers import (
    DatosWidgetSerializer,
    ResultadoVerificacionSerializer,
    VerificarPagoSerializer,
)
from .services import (
    WompiError,
    WompiNoConfigurado,
    aplicar_transaccion,
    consultar_transaccion,
    crear_intento_de_pago,
)
from .signatures import evento_es_autentico

logger = logging.getLogger(__name__)


class CheckoutView(APIView):
    """Prepara un intento de pago y devuelve los datos para abrir el Widget."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: DatosWidgetSerializer})
    def post(self, request, pedido_id):
        pedido = get_object_or_404(Pedido, pk=pedido_id, usuario=request.user)

        if pedido.esta_pagado:
            return Response(
                {"detail": "Este pedido ya fue pagado."}, status=status.HTTP_409_CONFLICT
            )
        if pedido.estado == Pedido.Estado.CANCELADO:
            return Response(
                {"detail": "Este pedido esta cancelado."}, status=status.HTTP_409_CONFLICT
            )

        try:
            datos = crear_intento_de_pago(pedido)
        except WompiNoConfigurado as exc:
            # Mensaje explicito: es el error que vera el equipo mientras no
            # tenga las llaves de sandbox.
            return Response(
                {"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        return Response(datos)


class VerificarPagoView(APIView):
    """
    Consulta a Wompi el estado real de la transaccion y reconcilia el pedido.

    Hace falta por dos razones: Wompi no puede alcanzar localhost, asi que en
    desarrollo el webhook nunca llega; y el resultado que devuelve el Widget en
    el navegador no es confiable, cualquiera puede invocarlo desde la consola.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=VerificarPagoSerializer, responses={200: ResultadoVerificacionSerializer}
    )
    def post(self, request, pedido_id):
        pedido = get_object_or_404(Pedido, pk=pedido_id, usuario=request.user)

        serializer = VerificarPagoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transaction_id = serializer.validated_data.get("transaction_id", "")
        if not transaction_id:
            ultimo = pedido.pago_vigente
            transaction_id = ultimo.wompi_transaction_id if ultimo else ""
        if not transaction_id:
            return Response(
                {"detail": "No hay una transaccion que verificar para este pedido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            datos = consultar_transaccion(transaction_id)
        except WompiError as exc:
            logger.warning("Verificacion fallida pedido=%s: %s", pedido.numero, exc)
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        # La referencia que devuelve Wompi tiene que ser una de este pedido.
        # Asi un transaction_id ajeno no puede usarse para aprobar un pedido
        # que no se pago.
        referencia = datos.get("reference")
        if not pedido.pagos.filter(referencia=referencia).exists():
            logger.warning(
                "Transaccion %s no corresponde al pedido %s", transaction_id, pedido.numero
            )
            return Response(
                {"detail": "Esta transaccion no corresponde a este pedido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        aplicar_transaccion(datos)
        pedido.refresh_from_db()

        return Response(
            {
                "pedido": PedidoSerializer(pedido, context={"request": request}).data,
                "estado_pago": (pedido.pago_vigente.estado if pedido.pago_vigente else None),
            }
        )


class WompiWebhookView(APIView):
    """
    Recibe los eventos de Wompi.

    Publico por necesidad (lo llama Wompi, no un usuario), pero solo actua si
    el checksum coincide.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=None, responses={200: None})
    def post(self, request):
        payload = request.data
        checksum_recibido = request.headers.get("X-Event-Checksum")

        if not evento_es_autentico(payload, settings.WOMPI_EVENTS_SECRET, checksum_recibido):
            logger.warning("Evento de Wompi con checksum invalido; se descarta.")
            return Response(
                {"detail": "Firma invalida."}, status=status.HTTP_401_UNAUTHORIZED
            )

        transaccion = (payload.get("data") or {}).get("transaction") or {}
        checksum = (payload.get("signature") or {}).get("checksum") or checksum_recibido

        try:
            # El savepoint es obligatorio: capturar un IntegrityError sin el
            # deja la transaccion en curso inutilizable para el resto de la
            # peticion.
            with transaction.atomic():
                WompiEvent.objects.create(
                    checksum=checksum,
                    evento=payload.get("event", ""),
                    transaccion_id=transaccion.get("id", ""),
                )
        except IntegrityError:
            # Reintento de un evento ya procesado. Se responde 200 para que
            # Wompi deje de reenviarlo.
            logger.info("Evento repetido de Wompi; ya estaba procesado.")
            return Response({"detail": "Evento ya procesado."})

        if payload.get("event") != "transaction.updated":
            # Los eventos de tokens (Nequi, Bancolombia) quedan fuera del MVP.
            return Response({"detail": "Evento ignorado."})

        pago = aplicar_transaccion(transaccion)
        if pago is None:
            # Referencia desconocida: se responde 200 igual, porque reintentarlo
            # no va a cambiar el resultado.
            return Response({"detail": "Referencia desconocida."})

        return Response({"detail": "Procesado.", "estado": pago.estado})
