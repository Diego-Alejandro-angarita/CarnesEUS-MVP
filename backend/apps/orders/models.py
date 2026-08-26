import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.catalog.models import Producto
from apps.common.models import TimeStampedModel

CERO = Decimal("0")


def generar_numero_pedido():
    """Numero legible para el cliente y para el mostrador: CE-20260821-9F3A2B."""
    sufijo = uuid.uuid4().hex[:6].upper()
    return f"CE-{timezone.localdate():%Y%m%d}-{sufijo}"


class Carrito(TimeStampedModel):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="carritos",
        verbose_name="usuario",
    )
    activo = models.BooleanField("activo", default=True)

    class Meta:
        verbose_name = "carrito"
        verbose_name_plural = "carritos"
        ordering = ["-creado_en"]
        constraints = [
            # Un solo carrito activo por usuario, garantizado por la base de
            # datos y no por la vista.
            models.UniqueConstraint(
                fields=["usuario"],
                condition=models.Q(activo=True),
                name="un_carrito_activo_por_usuario",
            )
        ]

    def __str__(self):
        return f"Carrito de {self.usuario.email}"

    @property
    def subtotal(self):
        return sum((item.subtotal for item in self.items.all()), CERO)


class ItemCarrito(TimeStampedModel):
    carrito = models.ForeignKey(
        Carrito, on_delete=models.CASCADE, related_name="items", verbose_name="carrito"
    )
    producto = models.ForeignKey(
        Producto, on_delete=models.CASCADE, related_name="items_carrito", verbose_name="producto"
    )
    cantidad = models.DecimalField(
        "cantidad",
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )

    class Meta:
        verbose_name = "item del carrito"
        verbose_name_plural = "items del carrito"
        unique_together = [("carrito", "producto")]
        ordering = ["creado_en"]

    def __str__(self):
        return f"{self.cantidad} x {self.producto.nombre}"

    @property
    def subtotal(self):
        return (self.producto.precio * self.cantidad).quantize(Decimal("0.01"))


class Pedido(TimeStampedModel):
    """FR-12: el pedido y su ciclo de estados."""

    class Estado(models.TextChoices):
        PENDIENTE_PAGO = "PENDIENTE_PAGO", "Pendiente de pago"
        PAGADO = "PAGADO", "Pagado"
        EN_PREPARACION = "EN_PREPARACION", "En preparacion"
        ENVIADO = "ENVIADO", "Enviado"
        ENTREGADO = "ENTREGADO", "Entregado"
        CANCELADO = "CANCELADO", "Cancelado"

    # Estados que el personal puede fijar a mano desde el panel. PAGADO no
    # esta: lo decide la pasarela, no el mostrador.
    ESTADOS_GESTIONABLES = [
        Estado.EN_PREPARACION,
        Estado.ENVIADO,
        Estado.ENTREGADO,
        Estado.CANCELADO,
    ]

    numero = models.CharField(
        "numero", max_length=24, unique=True, default=generar_numero_pedido, editable=False
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="pedidos",
        verbose_name="usuario",
    )
    direccion = models.ForeignKey(
        "accounts.Direccion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pedidos",
        verbose_name="direccion",
    )
    # La direccion se copia al pedido: si el cliente la edita o la borra,
    # el historial de entrega no debe cambiar.
    direccion_texto = models.CharField("direccion de entrega", max_length=300)
    estado = models.CharField(
        "estado", max_length=20, choices=Estado.choices, default=Estado.PENDIENTE_PAGO
    )
    subtotal = models.DecimalField("subtotal", max_digits=12, decimal_places=2, default=CERO)
    descuento = models.DecimalField("descuento", max_digits=12, decimal_places=2, default=CERO)
    costo_domicilio = models.DecimalField(
        "costo del domicilio", max_digits=12, decimal_places=2, default=CERO
    )
    total = models.DecimalField("total", max_digits=12, decimal_places=2, default=CERO)
    notas = models.CharField("notas", max_length=300, blank=True)

    class Meta:
        verbose_name = "pedido"
        verbose_name_plural = "pedidos"
        ordering = ["-creado_en"]
        indexes = [
            models.Index(fields=["usuario", "-creado_en"]),
            models.Index(fields=["estado", "-creado_en"]),
        ]

    def __str__(self):
        return f"{self.numero} ({self.get_estado_display()})"

    @property
    def esta_pagado(self):
        return self.estado not in (self.Estado.PENDIENTE_PAGO, self.Estado.CANCELADO)

    @property
    def pago_vigente(self):
        """El ultimo intento de pago; es el unico que le interesa al cliente."""
        return self.pagos.order_by("-creado_en").first()

    def recalcular_totales(self):
        self.subtotal = sum((item.subtotal for item in self.items.all()), CERO)
        self.total = self.subtotal - self.descuento + self.costo_domicilio
        return self.total


class ItemPedido(TimeStampedModel):
    """
    Linea de un pedido, con los datos congelados al momento de comprar.

    Si manana sube el precio del lomo, los pedidos historicos no cambian.
    """

    pedido = models.ForeignKey(
        Pedido, on_delete=models.CASCADE, related_name="items", verbose_name="pedido"
    )
    producto = models.ForeignKey(
        Producto,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="items_pedido",
        verbose_name="producto",
    )
    nombre_producto = models.CharField("nombre del producto", max_length=120)
    precio_unitario = models.DecimalField("precio unitario", max_digits=12, decimal_places=2)
    unidad_medida = models.CharField("unidad de medida", max_length=10)
    cantidad = models.DecimalField("cantidad", max_digits=10, decimal_places=3)
    subtotal = models.DecimalField("subtotal", max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = "item del pedido"
        verbose_name_plural = "items del pedido"
        ordering = ["id"]

    def __str__(self):
        return f"{self.cantidad} x {self.nombre_producto}"
