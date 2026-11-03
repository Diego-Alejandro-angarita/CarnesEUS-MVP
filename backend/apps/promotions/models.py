from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.catalog.models import Producto
from apps.common.models import TimeStampedModel


class PromocionQuerySet(models.QuerySet):
    def vigentes(self, hoy=None):
        """Las que rigen hoy: activas y con hoy dentro de sus fechas, ambas incluidas."""
        hoy = hoy or timezone.localdate()
        return self.filter(activa=True, fecha_inicio__lte=hoy, fecha_fin__gte=hoy)


class Promocion(TimeStampedModel):
    """
    Descuento porcentual sobre un grupo de productos (FR-13).

    Rige entre dos fechas, ambas incluidas, y solo mientras este activa: el
    interruptor permite pausarla sin perder las fechas. Si un producto queda en
    varias promociones vigentes a la vez, se le aplica la de mayor porcentaje.
    """

    nombre = models.CharField("nombre", max_length=120)
    porcentaje = models.PositiveSmallIntegerField(
        "porcentaje de descuento",
        validators=[MinValueValidator(1), MaxValueValidator(99)],
    )
    productos = models.ManyToManyField(
        Producto,
        verbose_name="productos",
        related_name="promociones",
    )
    fecha_inicio = models.DateField("fecha de inicio")
    fecha_fin = models.DateField("fecha de fin")
    activa = models.BooleanField("activa", default=True)

    objects = PromocionQuerySet.as_manager()

    class Meta:
        verbose_name = "promocion"
        verbose_name_plural = "promociones"
        ordering = ["-fecha_inicio", "nombre"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(fecha_fin__gte=models.F("fecha_inicio")),
                name="promo_fechas_en_orden",
            ),
            models.CheckConstraint(
                condition=models.Q(porcentaje__gte=1, porcentaje__lte=99),
                name="promo_porcentaje_valido",
            ),
        ]

    def __str__(self):
        return f"{self.nombre} (-{self.porcentaje}%)"

    @property
    def estado(self) -> str:
        """Como esta hoy: inactiva, programada, vigente o vencida."""
        if not self.activa:
            return "inactiva"
        hoy = timezone.localdate()
        if hoy < self.fecha_inicio:
            return "programada"
        if hoy > self.fecha_fin:
            return "vencida"
        return "vigente"
