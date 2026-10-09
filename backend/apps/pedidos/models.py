from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.catalog.models import Producto
from apps.common.models import TimeStampedModel


class Pedido(TimeStampedModel):
    """
    Pedido confirmado (FR-11).

    Aqui si se congela el precio: el carrito usa el precio de hoy, el pedido el
    de cuando el cliente compro. Se puede comprar sin cuenta, por eso `usuario`
    es opcional y los datos de contacto viven en el propio pedido.
    """

    class Estado(models.TextChoices):
        POR_CONFIRMAR = "por_confirmar", "Por confirmar (transferencia)"
        POR_COBRAR = "por_cobrar", "Por cobrar (contraentrega)"
        PAGADO = "pagado", "Pagado"

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="usuario",
        on_delete=models.SET_NULL,
        related_name="pedidos",
        null=True,
        blank=True,
    )
    nombre = models.CharField("nombre", max_length=120)
    email = models.EmailField("correo electronico")
    telefono = models.CharField("telefono", max_length=20)
    direccion = models.CharField("direccion", max_length=200)
    municipio = models.CharField("municipio", max_length=80)
    barrio = models.CharField("barrio", max_length=120)
    notas = models.CharField("notas para la entrega", max_length=300, blank=True)
    estado = models.CharField("estado", max_length=13, choices=Estado.choices)
    total = models.DecimalField("total", max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = "pedido"
        verbose_name_plural = "pedidos"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"Pedido #{self.pk} de {self.nombre}"


class ItemPedido(TimeStampedModel):
    pedido = models.ForeignKey(
        Pedido, verbose_name="pedido", on_delete=models.CASCADE, related_name="items"
    )
    producto = models.ForeignKey(
        Producto,
        verbose_name="producto",
        on_delete=models.PROTECT,
        related_name="items_pedido",
    )
    # Copia del nombre y del precio al momento de comprar: si el producto cambia
    # despues, el pedido sigue diciendo lo que el cliente compro.
    nombre = models.CharField("nombre", max_length=120)
    precio_unitario = models.DecimalField("precio unitario", max_digits=10, decimal_places=2)
    cantidad = models.PositiveIntegerField("cantidad")

    class Meta:
        verbose_name = "item del pedido"
        verbose_name_plural = "items del pedido"
        ordering = ["id"]

    def __str__(self):
        return f"{self.cantidad} x {self.nombre}"

    @property
    def subtotal(self) -> Decimal:
        return self.precio_unitario * self.cantidad


class Pago(TimeStampedModel):
    """
    Como va a pagar el cliente un pedido.

    No se procesa ningun cobro en linea: la transferencia la verifica el
    personal y la contraentrega se cobra al entregar. Por eso el pago nace
    siempre "pendiente" y el personal lo marca "aprobado" desde el admin.
    """

    class Metodo(models.TextChoices):
        TRANSFERENCIA = "transferencia", "Transferencia"
        CONTRAENTREGA_QR = "contraentrega_qr", "Contraentrega con QR"
        CONTRAENTREGA_DATAFONO = "contraentrega_datafono", "Contraentrega con datafono"

    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        APROBADO = "aprobado", "Aprobado"

    pedido = models.OneToOneField(
        Pedido, verbose_name="pedido", on_delete=models.CASCADE, related_name="pago"
    )
    metodo = models.CharField("metodo", max_length=22, choices=Metodo.choices)
    estado = models.CharField(
        "estado", max_length=10, choices=Estado.choices, default=Estado.PENDIENTE
    )
    monto = models.DecimalField("monto", max_digits=12, decimal_places=2)
    referencia = models.CharField(
        "referencia de la transferencia", max_length=60, blank=True
    )

    class Meta:
        verbose_name = "pago"
        verbose_name_plural = "pagos"

    def __str__(self):
        return f"{self.get_metodo_display()} - {self.get_estado_display()}"

    @property
    def es_contraentrega(self) -> bool:
        return self.metodo in METODOS_CONTRAENTREGA


METODOS_CONTRAENTREGA = (Pago.Metodo.CONTRAENTREGA_QR, Pago.Metodo.CONTRAENTREGA_DATAFONO)