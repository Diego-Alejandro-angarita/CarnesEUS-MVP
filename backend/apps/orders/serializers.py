from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.models import Direccion
from apps.catalog.serializers import ProductoSerializer

from .models import Carrito, ItemCarrito, ItemPedido, Pedido


class ItemCarritoSerializer(serializers.ModelSerializer):
    producto_detalle = ProductoSerializer(source="producto", read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ItemCarrito
        fields = ["id", "producto", "producto_detalle", "cantidad", "subtotal"]

    def validate(self, attrs):
        producto = attrs.get("producto") or getattr(self.instance, "producto", None)
        cantidad = attrs.get("cantidad") or getattr(self.instance, "cantidad", None)
        if producto and not producto.disponible:
            raise serializers.ValidationError({"producto": "Este producto no esta disponible."})
        if producto and cantidad and producto.stock < cantidad:
            raise serializers.ValidationError(
                {"cantidad": f"Solo quedan {producto.stock} de '{producto.nombre}'."}
            )
        return attrs


class CarritoSerializer(serializers.ModelSerializer):
    items = ItemCarritoSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Carrito
        fields = ["id", "items", "subtotal"]


class ItemPedidoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemPedido
        fields = [
            "id",
            "producto",
            "nombre_producto",
            "precio_unitario",
            "unidad_medida",
            "cantidad",
            "subtotal",
        ]


class PedidoSerializer(serializers.ModelSerializer):
    items = ItemPedidoSerializer(many=True, read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    cliente_email = serializers.EmailField(source="usuario.email", read_only=True)
    cliente_nombre = serializers.CharField(source="usuario.nombre_completo", read_only=True)
    estado_pago = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            "id",
            "numero",
            "estado",
            "estado_display",
            "estado_pago",
            "direccion_texto",
            "subtotal",
            "descuento",
            "costo_domicilio",
            "total",
            "notas",
            "items",
            "cliente_email",
            "cliente_nombre",
            "creado_en",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_estado_pago(self, obj):
        pago = obj.pago_vigente
        return pago.estado if pago else None


class CrearPedidoSerializer(serializers.Serializer):
    """Convierte el carrito activo en un pedido."""

    direccion = serializers.PrimaryKeyRelatedField(queryset=Direccion.objects.all())
    notas = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")

    def validate_direccion(self, value):
        if value.usuario_id != self.context["request"].user.id:
            raise serializers.ValidationError("La direccion no pertenece a este usuario.")
        return value


class CambiarEstadoSerializer(serializers.Serializer):
    """FR-12: el personal mueve el pedido por el flujo de preparacion y entrega."""

    estado = serializers.ChoiceField(choices=Pedido.Estado.choices)

    def validate_estado(self, value):
        if value not in Pedido.ESTADOS_GESTIONABLES:
            raise serializers.ValidationError(
                "Este estado lo define la pasarela de pagos, no se asigna a mano."
            )
        return value
