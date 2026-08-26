from rest_framework import serializers

from .models import Categoria, Producto


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ["id", "nombre", "slug", "descripcion", "orden"]


class ProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    categoria_slug = serializers.SlugField(source="categoria.slug", read_only=True)
    unidad_medida_display = serializers.CharField(
        source="get_unidad_medida_display", read_only=True
    )
    hay_existencias = serializers.BooleanField(read_only=True)

    class Meta:
        model = Producto
        fields = [
            "id",
            "nombre",
            "slug",
            "descripcion",
            "categoria",
            "categoria_nombre",
            "categoria_slug",
            "precio",
            "unidad_medida",
            "unidad_medida_display",
            "stock",
            "disponible",
            "hay_existencias",
            "imagen",
        ]


class DisponibilidadSerializer(serializers.Serializer):
    """FR-09: cambiar disponibilidad sin tocar el resto del producto."""

    disponible = serializers.BooleanField()
