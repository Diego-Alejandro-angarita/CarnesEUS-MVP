"""Lo que el catalogo necesita saber de las promociones para pintar precios."""

from decimal import ROUND_HALF_UP, Decimal

from django.db.models import OuterRef, QuerySet, Subquery

from .models import Promocion


def anotar_descuento(productos: QuerySet) -> QuerySet:
    """
    Agrega a cada producto el campo `descuento`: el mayor porcentaje entre sus
    promociones vigentes, o None si no tiene ninguna.

    Va como subconsulta y no como Max sobre un join para no meter un GROUP BY
    en el listado, que convive con la busqueda, los filtros y la paginacion.
    """
    mayor = (
        Promocion.objects.vigentes()
        .filter(productos=OuterRef("pk"))
        .order_by("-porcentaje")
        .values("porcentaje")[:1]
    )
    return productos.annotate(descuento=Subquery(mayor))


def precio_con_descuento(precio: Decimal, porcentaje: int) -> Decimal:
    """Precio rebajado, redondeado a pesos enteros."""
    rebajado = precio * (100 - porcentaje) / 100
    return rebajado.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
