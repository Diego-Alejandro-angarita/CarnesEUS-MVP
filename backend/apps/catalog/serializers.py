from rest_framework import serializers

from .models import Producto


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
