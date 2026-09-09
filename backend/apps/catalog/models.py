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


class ProductoQuerySet(models.QuerySet):
    def visibles(self):
        """Los productos sin archivar: lo que ven el catalogo y la administracion."""
        return self.filter(archivado=False)


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
    # Eliminar un producto (FR-05) lo archiva en vez de borrar la fila: asi el
    # historial que se apoye en el sigue teniendo a que apuntar. Es distinto de
    # "disponible", que solo dice si hay existencias hoy.
    archivado = models.BooleanField("archivado", default=False)

    objects = ProductoQuerySet.as_manager()

    class Meta:
        verbose_name = "producto"
        verbose_name_plural = "productos"
        ordering = ["-disponible", "nombre"]
        indexes = [
            models.Index(fields=["disponible"], name="catalog_prod_dispon_idx"),
            models.Index(fields=["archivado"], name="catalog_prod_archiv_idx"),
        ]

    def __str__(self):
        return self.nombre
