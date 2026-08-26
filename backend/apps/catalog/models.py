from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel


class Categoria(TimeStampedModel):
    nombre = models.CharField("nombre", max_length=80, unique=True)
    slug = models.SlugField("slug", max_length=80, unique=True)
    descripcion = models.TextField("descripcion", blank=True)
    orden = models.PositiveSmallIntegerField("orden", default=0)

    class Meta:
        verbose_name = "categoria"
        verbose_name_plural = "categorias"
        ordering = ["orden", "nombre"]

    def __str__(self):
        return self.nombre


class Producto(TimeStampedModel):
    """Un corte de carne del catalogo."""

    class UnidadMedida(models.TextChoices):
        KILOGRAMO = "KG", "Kilogramo"
        UNIDAD = "UNIDAD", "Unidad"

    nombre = models.CharField("nombre", max_length=120)
    slug = models.SlugField("slug", max_length=140, unique=True)
    descripcion = models.TextField("descripcion", blank=True)
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        related_name="productos",
        verbose_name="categoria",
    )
    precio = models.DecimalField(
        "precio",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Precio en COP por unidad de medida.",
    )
    unidad_medida = models.CharField(
        "unidad de medida",
        max_length=10,
        choices=UnidadMedida.choices,
        default=UnidadMedida.KILOGRAMO,
    )
    stock = models.DecimalField(
        "stock",
        max_digits=10,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
        help_text="En kilos o unidades, segun la unidad de medida.",
    )
    disponible = models.BooleanField("disponible", default=True)
    imagen = models.ImageField("imagen", upload_to="productos/", blank=True, null=True)

    class Meta:
        verbose_name = "producto"
        verbose_name_plural = "productos"
        ordering = ["nombre"]
        indexes = [
            # El catalogo filtra por estos campos en cada carga; con 100-500
            # productos y un techo de 800 ms no puede escanear la tabla.
            models.Index(fields=["categoria", "disponible"]),
            models.Index(fields=["disponible", "nombre"]),
        ]

    def __str__(self):
        return self.nombre

    @property
    def hay_existencias(self):
        return self.disponible and self.stock > 0


class Promocion(TimeStampedModel):
    """
    Descuento sobre productos concretos.

    El modelo y su administracion quedan listos; aplicarlo al total del pedido
    es trabajo del Sprint 1 (ver README).
    """

    class Tipo(models.TextChoices):
        PORCENTAJE = "PORCENTAJE", "Porcentaje"
        MONTO_FIJO = "MONTO_FIJO", "Monto fijo"

    nombre = models.CharField("nombre", max_length=120)
    descripcion = models.TextField("descripcion", blank=True)
    tipo = models.CharField("tipo", max_length=12, choices=Tipo.choices)
    valor = models.DecimalField(
        "valor",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Porcentaje (1-100) o monto en COP, segun el tipo.",
    )
    productos = models.ManyToManyField(
        Producto,
        related_name="promociones",
        blank=True,
        verbose_name="productos",
    )
    inicia_en = models.DateTimeField("inicia en")
    termina_en = models.DateTimeField("termina en")
    activa = models.BooleanField("activa", default=True)

    class Meta:
        verbose_name = "promocion"
        verbose_name_plural = "promociones"
        ordering = ["-inicia_en"]

    def __str__(self):
        return self.nombre

    @property
    def vigente(self):
        ahora = timezone.now()
        return self.activa and self.inicia_en <= ahora <= self.termina_en

    def descuento_sobre(self, precio):
        """Descuento en COP que esta promocion aplica a un precio dado."""
        if not self.vigente:
            return Decimal("0")
        if self.tipo == self.Tipo.PORCENTAJE:
            descuento = precio * self.valor / Decimal("100")
        else:
            descuento = self.valor
        # Nunca dejar el precio en negativo.
        return min(descuento, precio)
