from rest_framework import serializers

from apps.catalog.models import Producto

from .models import Promocion


class ProductoResumenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = ["id", "nombre"]
        read_only_fields = fields


class PromocionSerializer(serializers.ModelSerializer):
    """
    Alta, edicion y listado de promociones.

    Los productos entran como lista de ids y salen tambien con su nombre en
    `productos_detalle`, para que el listado no tenga que pedirlos aparte.
    """

    productos = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Producto.objects.visibles(),
        allow_empty=False,
        error_messages={
            "empty": "Elige al menos un producto.",
            "does_not_exist": "El producto {pk_value} no existe o ya no esta en el catalogo.",
        },
    )
    productos_detalle = ProductoResumenSerializer(source="productos", many=True, read_only=True)
    estado = serializers.CharField(read_only=True)

    class Meta:
        model = Promocion
        fields = [
            "id",
            "nombre",
            "porcentaje",
            "fecha_inicio",
            "fecha_fin",
            "activa",
            "productos",
            "productos_detalle",
            "estado",
        ]
        extra_kwargs = {
            "porcentaje": {
                "min_value": 1,
                "max_value": 99,
                "error_messages": {
                    "min_value": "El descuento debe ser de al menos 1 por ciento.",
                    "max_value": "El descuento no puede pasar de 99 por ciento.",
                },
            },
        }

    def validate(self, atributos):
        # En un PATCH parcial puede llegar una sola fecha: la otra es la guardada.
        inicio = atributos.get("fecha_inicio", getattr(self.instance, "fecha_inicio", None))
        fin = atributos.get("fecha_fin", getattr(self.instance, "fecha_fin", None))
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError(
                {"fecha_fin": "La fecha de fin no puede ser anterior a la de inicio."}
            )
        return atributos


class ProductoOpcionSerializer(serializers.ModelSerializer):
    """Producto tal como lo necesita el selector del formulario de promociones."""

    categoria = serializers.CharField(source="categoria.nombre", read_only=True)

    class Meta:
        model = Producto
        fields = ["id", "nombre", "categoria", "precio"]
        read_only_fields = fields
