from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import TimeStampedModel


class Categoria(TimeStampedModel):
    nombre = models.CharField("nombre", max_length=80, unique=True)
    slug = models.SlugField("slug", max_length=80, unique=True)

    class Meta:
        verbose_name = "categoria"
        verbose_name_plural = "categorias"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Producto(TimeStampedModel):
    categoria = models.ForeignKey(
        Categoria,
        verbose_name="categoria",
        on_delete=models.PROTECT,
        related_name="productos",
    )
    nombre = models.CharField("nombre", max_length=120)
    slug = models.SlugField("slug", max_length=120, unique=True)
    descripcion = models.TextField("descripcion", blank=True)
    presentacion = models.CharField("presentacion", max_length=60)
    precio = models.DecimalField(
        "precio",
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    foto_url = models.URLField("foto", max_length=500, blank=True)
    disponible = models.BooleanField("disponible", default=True)

    class Meta:
        verbose_name = "producto"
        verbose_name_plural = "productos"
        ordering = ["-disponible", "nombre"]
        indexes = [models.Index(fields=["disponible"], name="catalog_prod_dispon_idx")]

    def __str__(self):
        return self.nombre
