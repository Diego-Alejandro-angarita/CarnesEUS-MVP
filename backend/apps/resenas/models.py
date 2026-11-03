from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.catalog.models import Producto
from apps.common.models import TimeStampedModel


class Resena(TimeStampedModel):
    """
    Calificacion y comentario de un cliente sobre un producto que compro (FR-18).

    Solo se puede crear si el usuario tiene al menos un pedido con ese
    producto (ver ResenaCrearSerializer), y solo una por usuario y producto:
    para cambiar de opinion se edita la que ya existe en vez de duplicarla.
    """

    producto = models.ForeignKey(
        Producto,
        verbose_name="producto",
        on_delete=models.CASCADE,
        related_name="resenas",
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="usuario",
        on_delete=models.CASCADE,
        related_name="resenas",
    )
    calificacion = models.PositiveSmallIntegerField(
        "calificacion", validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comentario = models.TextField("comentario", blank=True)

    class Meta:
        verbose_name = "reseña"
        verbose_name_plural = "reseñas"
        ordering = ["-creado_en"]
        constraints = [
            models.UniqueConstraint(
                fields=["producto", "usuario"], name="resenas_una_por_usuario_y_producto"
            )
        ]

    def __str__(self):
        return f"{self.calificacion} estrellas de {self.usuario} a {self.producto}"
