from django_filters import rest_framework as filters

from .models import Producto


class ProductoFilter(filters.FilterSet):
    """FR-08: filtros del catalogo."""

    categoria = filters.CharFilter(field_name="categoria__slug", lookup_expr="iexact")
    precio_min = filters.NumberFilter(field_name="precio", lookup_expr="gte")
    precio_max = filters.NumberFilter(field_name="precio", lookup_expr="lte")
    unidad_medida = filters.ChoiceFilter(choices=Producto.UnidadMedida.choices)

    class Meta:
        model = Producto
        fields = ["categoria", "disponible", "precio_min", "precio_max", "unidad_medida"]
