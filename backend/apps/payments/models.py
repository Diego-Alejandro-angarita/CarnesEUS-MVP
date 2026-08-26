from django.db import models

from apps.common.models import TimeStampedModel
from apps.orders.models import Pedido


class Pago(TimeStampedModel):
    """
    Un intento de pago contra Wompi.

    Es una relacion de muchos-a-uno con el pedido, no uno-a-uno: si al cliente
    le rechazan la tarjeta y reintenta, Wompi exige una referencia nueva. Cada
    intento queda como su propio registro, y asi el evento tardio de un intento
    rechazado no puede pisar el estado del intento que si fue aprobado.

    Aqui no se guarda ningun dato de tarjeta: eso lo maneja Wompi.
    """

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        APROBADO = "APROBADO", "Aprobado"
        RECHAZADO = "RECHAZADO", "Rechazado"
        ANULADO = "ANULADO", "Anulado"
        ERROR = "ERROR", "Error"

    # Estados finales de Wompi -> estados propios.
    MAPA_ESTADOS_WOMPI = {
        "PENDING": Estado.PENDIENTE,
        "APPROVED": Estado.APROBADO,
        "DECLINED": Estado.RECHAZADO,
        "VOIDED": Estado.ANULADO,
        "ERROR": Estado.ERROR,
    }

    pedido = models.ForeignKey(
        Pedido, on_delete=models.CASCADE, related_name="pagos", verbose_name="pedido"
    )
    referencia = models.CharField(
        "referencia", max_length=64, unique=True, help_text="Referencia unica enviada a Wompi."
    )
    estado = models.CharField(
        "estado", max_length=12, choices=Estado.choices, default=Estado.PENDIENTE
    )
    monto_en_centavos = models.PositiveBigIntegerField("monto en centavos")
    moneda = models.CharField("moneda", max_length=3, default="COP")
    wompi_transaction_id = models.CharField(
        "id de transaccion en Wompi", max_length=64, blank=True, db_index=True
    )
    metodo_pago = models.CharField(
        "metodo de pago",
        max_length=32,
        blank=True,
        help_text="Lo que reporte Wompi. En el MVP siempre CARD.",
    )
    raw_response = models.JSONField("respuesta de Wompi", default=dict, blank=True)

    class Meta:
        verbose_name = "pago"
        verbose_name_plural = "pagos"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.referencia} ({self.get_estado_display()})"

    @property
    def monto(self):
        """El monto en pesos, para mostrarlo sin tener que dividir por 100."""
        return self.monto_en_centavos / 100


class WompiEvent(TimeStampedModel):
    """
    Registro de eventos ya procesados.

    Wompi reintenta hasta 3 veces en 24 horas ante cualquier respuesta que no
    sea 200. Sin esta tabla, un reintento volveria a descontar stock.
    """

    checksum = models.CharField("checksum", max_length=128, unique=True)
    evento = models.CharField("evento", max_length=64)
    transaccion_id = models.CharField("id de transaccion", max_length=64, blank=True)

    class Meta:
        verbose_name = "evento de Wompi"
        verbose_name_plural = "eventos de Wompi"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.evento} {self.transaccion_id}"
