from django.conf import settings
from rest_framework import serializers

from .models import ItemPedido, Pago, Pedido


class CrearPedidoSerializer(serializers.Serializer):
    """Entrada de POST /api/pedidos/: entrega, contacto y forma de pago."""

    metodo_pago = serializers.ChoiceField(choices=Pago.Metodo.choices)
    nombre = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    telefono = serializers.CharField(max_length=20)
    direccion = serializers.CharField(max_length=200)
    municipio = serializers.CharField(max_length=80)
    barrio = serializers.CharField(max_length=120)
    notas = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")


class ItemPedidoSerializer(serializers.ModelSerializer):
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    # Para que la confirmacion de compra pueda enlazar cada linea con la ficha
    # del producto y dejarle su reseña (FR-18), aunque luego cambie de nombre.
    producto_id = serializers.IntegerField(read_only=True)
    producto_slug = serializers.SlugField(source="producto.slug", read_only=True)

    class Meta:
        model = ItemPedido
        fields = ["producto_id", "producto_slug", "nombre", "precio_unitario", "cantidad", "subtotal"]


class PagoSerializer(serializers.ModelSerializer):
    metodo_nombre = serializers.CharField(source="get_metodo_display", read_only=True)

    class Meta:
        model = Pago
        fields = ["metodo", "metodo_nombre", "estado", "monto", "referencia"]


class PedidoSerializer(serializers.ModelSerializer):
    """El pedido ya creado, con lo justo para pintar la confirmacion."""

    items = ItemPedidoSerializer(many=True, read_only=True)
    pago = PagoSerializer(read_only=True)
    instrucciones_pago = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            "id",
            "estado",
            "total",
            "nombre",
            "email",
            "telefono",
            "direccion",
            "municipio",
            "barrio",
            "notas",
            "items",
            "pago",
            "instrucciones_pago",
            "creado_en",
        ]

    def get_instrucciones_pago(self, pedido: Pedido) -> dict | None:
        """Con transferencia, los datos de la cuenta a la que debe pagar."""
        if pedido.pago.metodo == Pago.Metodo.TRANSFERENCIA:
            return settings.DATOS_TRANSFERENCIA
        return None