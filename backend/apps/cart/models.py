import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.catalog.models import Producto
from apps.common.models import TimeStampedModel


class Carrito(TimeStampedModel):
    """
    Carrito de compras (FR-10).

    Funciona con o sin cuenta. Un visitante sin registrarse arma su carrito y se
    identifica con el token; cuando existe el inicio de sesion (FR-02), el
    carrito anonimo se fusiona con el del usuario. Obligar a registrarse antes
    de poder agregar al carrito espanta compradores.
    """

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        verbose_name="usuario",
        on_delete=models.CASCADE,
        related_name="carrito",
        null=True,
        blank=True,
    )
    token = models.UUIDField("token", default=uuid.uuid4, unique=True, editable=False)

    class Meta:
        verbose_name = "carrito"
        verbose_name_plural = "carritos"
        ordering = ["-actualizado_en"]

    def __str__(self):
        return f"Carrito de {self.usuario}" if self.usuario_id else f"Carrito {self.token}"

    @property
    def total(self) -> Decimal:
        """Suma de los items que hoy se pueden comprar."""
        return sum((item.subtotal for item in self.items.all()), Decimal("0"))

    @property
    def cantidad_items(self) -> int:
        return sum(item.cantidad for item in self.items.all())

    def fusionar_con(self, otro: "Carrito") -> None:
        """
        Pasa los items de `otro` a este carrito y borra `otro`.

        Lo usara FR-02 al iniciar sesion: el visitante que armo un carrito sin
        cuenta no deberia perderlo al entrar. Si un producto esta en los dos, se
        suman las cantidades.
        """
        for item in otro.items.select_related("producto"):
            propio, creado = self.items.get_or_create(
                producto=item.producto,
                defaults={"cantidad": item.cantidad},
            )
            if not creado:
                propio.cantidad += item.cantidad
                propio.save(update_fields=["cantidad", "actualizado_en"])
        otro.delete()


class ItemCarrito(TimeStampedModel):
    """
    Una linea del carrito.

    No guarda el precio a proposito: el subtotal sale del precio que el producto
    tiene hoy. Un carrito no es un pedido. Congelar el precio aqui haria que un
    carrito abandonado en enero se cobrara con precios de enero. El precio se
    congela al confirmar el pedido, no antes.
    """

    carrito = models.ForeignKey(
        Carrito,
        verbose_name="carrito",
        on_delete=models.CASCADE,
        related_name="items",
    )
    producto = models.ForeignKey(
        Producto,
        verbose_name="producto",
        on_delete=models.PROTECT,
        related_name="items_carrito",
    )
    cantidad = models.PositiveIntegerField("cantidad", default=1, validators=[MinValueValidator(1)])

    class Meta:
        verbose_name = "item del carrito"
        verbose_name_plural = "items del carrito"
        ordering = ["creado_en"]
        constraints = [
            # Agregar dos veces el mismo producto sube la cantidad, no crea otra
            # fila. Si no, el carrito muestra el mismo corte repetido.
            models.UniqueConstraint(fields=["carrito", "producto"], name="cart_item_unico"),
        ]

    def __str__(self):
        return f"{self.cantidad} x {self.producto}"

    @property
    def comprable(self) -> bool:
        """Un producto agotado o archivado sigue en el carrito, pero no se cobra."""
        return self.producto.disponible and not self.producto.archivado

    @property
    def subtotal(self) -> Decimal:
        if not self.comprable:
            return Decimal("0")
        return self.producto.precio * self.cantidad