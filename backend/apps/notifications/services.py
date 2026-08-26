"""
Avisos al cliente sobre su pedido.

Modulo intencionalmente minimo: en desarrollo los correos se imprimen en
consola. Darle cuerpo (plantillas, SMTP real, envio asincrono) es trabajo del
Sprint 1; la frontera ya esta puesta para no tener que tocar pagos despues.
"""

import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def notificar_pedido_pagado(pedido):
    """Confirma al cliente que su pago fue aprobado."""
    asunto = f"Confirmamos tu pedido {pedido.numero}"
    cuerpo = (
        f"Hola {pedido.usuario.nombre_completo},\n\n"
        f"Recibimos tu pago por ${pedido.total:,.0f} COP.\n"
        f"Estamos preparando tu pedido {pedido.numero} y lo llevaremos a:\n"
        f"{pedido.direccion_texto}\n\n"
        "Gracias por comprar en CarnesEUS."
    )
    _enviar(asunto, cuerpo, pedido.usuario.email)


def notificar_cambio_de_estado(pedido):
    """Avisa cuando el pedido pasa a enviado o entregado."""
    asunto = f"Tu pedido {pedido.numero} cambio de estado"
    cuerpo = (
        f"Hola {pedido.usuario.nombre_completo},\n\n"
        f"Tu pedido {pedido.numero} ahora esta: {pedido.get_estado_display()}.\n"
    )
    _enviar(asunto, cuerpo, pedido.usuario.email)


def _enviar(asunto, cuerpo, destinatario):
    try:
        send_mail(
            asunto,
            cuerpo,
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-responder@carneseus.co"),
            [destinatario],
            fail_silently=False,
        )
    except Exception:
        # Un fallo de correo nunca debe tumbar un pago ya aprobado.
        logger.exception("No se pudo enviar el correo a %s", destinatario)
