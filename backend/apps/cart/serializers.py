from rest_framework import serializers

from apps.catalog.models import Producto

from .models import ItemCarrito


class ItemCarritoSerializer(serializers.ModelSerializer):
    """Una linea del carrito, con lo justo para pintarla sin otra peticion."""

    producto_id = serializers.IntegerField(source="producto.id", read_only=True)
    nombre = serializers.CharField(source="producto.nombre", read_only=True)
    slug = serializers.SlugField(source="producto.slug", read_only=True)
    presentacion = serializers.CharField(source="producto.presentacion", read_only=True)
    foto_url = serializers.URLField(source="producto.foto_url", read_only=True)
    precio = serializers.DecimalField(
        source="producto.precio", max_digits=10, decimal_places=2, read_only=True
    )
    comprable = serializers.BooleanField(read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ItemCarrito
        fields = [
            "id",
            "producto_id",
            "nombre",
            "slug",
            "presentacion",
            "foto_url",
            "precio",
            "cantidad",
            "comprable",
            "subtotal",
        ]
        read_only_fields = ["id"]


class CarritoSerializer(serializers.Serializer):
    """El carrito completo. El token lo guarda el navegador para volver a el."""

    token = serializers.UUIDField(read_only=True)
    items = ItemCarritoSerializer(many=True, read_only=True)
    cantidad_items = serializers.IntegerField(read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)


class AgregarItemSerializer(serializers.Serializer):
    """Entrada de POST /api/carrito/items/."""

    producto = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.visibles(),
        error_messages={"does_not_exist": "El producto no existe o ya no esta en el catalogo."},
    )
    cantidad = serializers.IntegerField(min_value=1, default=1)

    def validate_producto(self, producto: Producto) -> Producto:
        if not producto.disponible:
            raise serializers.ValidationError("Este producto esta agotado.")
        return producto


class ActualizarItemSerializer(serializers.ModelSerializer):
    """Entrada de PATCH /api/carrito/items/<id>/."""

    cantidad = serializers.IntegerField(min_value=1)

    class Meta:
        model = ItemCarrito
        fields = ["cantidad"]