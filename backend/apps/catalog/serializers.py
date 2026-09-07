from django.utils.text import slugify
from rest_framework import serializers

from .models import Categoria, Producto


class CategoriaSerializer(serializers.ModelSerializer):
    """Categorias para alimentar el selector del formulario de administracion."""

    class Meta:
        model = Categoria
        fields = ["id", "nombre", "slug"]
        read_only_fields = fields


class ProductoSerializer(serializers.ModelSerializer):
    categoria = serializers.CharField(source="categoria.nombre", read_only=True)

    class Meta:
        model = Producto
        fields = [
            "id",
            "nombre",
            "slug",
            "descripcion",
            "presentacion",
            "precio",
            "foto_url",
            "disponible",
            "categoria",
        ]
        read_only_fields = fields


class ProductoAdminSerializer(serializers.ModelSerializer):
    """
    Serializer de escritura para FR-03.

    Va aparte del publico a proposito: el catalogo (FR-00) expone la categoria
    como texto y todo de solo lectura, mientras que aqui la categoria entra por
    id y el slug se calcula solo a partir del nombre.
    """

    categoria = serializers.PrimaryKeyRelatedField(queryset=Categoria.objects.all())
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    slug = serializers.SlugField(max_length=120, required=False, allow_blank=True)

    class Meta:
        model = Producto
        fields = [
            "id",
            "categoria",
            "categoria_nombre",
            "nombre",
            "slug",
            "descripcion",
            "presentacion",
            "precio",
            "foto_url",
            "disponible",
        ]

    def validate_precio(self, valor):
        if valor <= 0:
            raise serializers.ValidationError("El precio debe ser mayor que cero.")
        return valor

    def validate_slug(self, valor):
        if valor and Producto.objects.filter(slug=valor).exists():
            raise serializers.ValidationError("Ya existe un producto con este slug.")
        return valor

    def create(self, datos_validados):
        if not datos_validados.get("slug"):
            datos_validados["slug"] = _slug_libre(datos_validados["nombre"])
        return super().create(datos_validados)


def _slug_libre(nombre):
    """Genera un slug a partir del nombre, con sufijo numerico si ya esta tomado."""
    base = slugify(nombre)[:120] or "producto"
    candidato = base
    numero = 2
    while Producto.objects.filter(slug=candidato).exists():
        sufijo = f"-{numero}"
        candidato = f"{base[: 120 - len(sufijo)]}{sufijo}"
        numero += 1
    return candidato
