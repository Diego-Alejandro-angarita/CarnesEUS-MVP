from django.conf import settings
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import ItemPedido, Pago, Pedido


class CambiarEstadoSerializer(serializers.Serializer):
    """Entrada del panel administrativo (FR-19) para mover un pedido de estado."""

    estado = serializers.ChoiceField(choices=Pedido.Estado.choices)


class CambiarEtapaSerializer(serializers.Serializer):
    """Entrada del panel para mover un pedido de etapa (FR-12)."""

    etapa = serializers.ChoiceField(choices=Pedido.Etapa.choices)


class ConsultarPedidoSerializer(serializers.Serializer):
    """Quien compro sin cuenta consulta su pedido con el numero y su correo (FR-12)."""

    numero = serializers.IntegerField(min_value=1)
    email = serializers.EmailField()


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
        fields = [
            "producto_id",
            "producto_slug",
            "nombre",
            "precio_unitario",
            "cantidad",
            "subtotal",
        ]


class PagoSerializer(serializers.ModelSerializer):
    metodo_nombre = serializers.CharField(source="get_metodo_display", read_only=True)

    class Meta:
        model = Pago
        fields = ["metodo", "metodo_nombre", "estado", "monto", "referencia"]


class PasoSeguimientoSerializer(serializers.Serializer):
    etapa = serializers.CharField()
    etapa_nombre = serializers.CharField()
    fecha = serializers.DateTimeField()


class PedidoSerializer(serializers.ModelSerializer):
    """El pedido ya creado, con lo justo para pintar la confirmacion."""

    items = ItemPedidoSerializer(many=True, read_only=True)
    pago = PagoSerializer(read_only=True)
    instrucciones_pago = serializers.SerializerMethodField()
    etapa_nombre = serializers.CharField(source="get_etapa_display", read_only=True)
    etapas_siguientes = serializers.ListField(child=serializers.CharField(), read_only=True)
    seguimiento = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            "id",
            "estado",
            "etapa",
            "etapa_nombre",
            "etapas_siguientes",
            "seguimiento",
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

    @extend_schema_field(PasoSeguimientoSerializer(many=True))
    def get_seguimiento(self, pedido: Pedido) -> list[dict]:
        """Las etapas por las que ya paso el pedido, con su fecha (FR-12)."""
        pasos = [(Pedido.Etapa.RECIBIDO, pedido.creado_en)]
        pasos += [(cambio.etapa, cambio.creado_en) for cambio in pedido.historial.all()]
        return [
            {"etapa": etapa, "etapa_nombre": Pedido.Etapa(etapa).label, "fecha": fecha}
            for etapa, fecha in pasos
        ]


class PedidoListaSerializer(serializers.ModelSerializer):
    """Una fila de la tabla del panel administrativo (FR-19): lo justo para listar."""

    metodo_pago = serializers.CharField(source="pago.get_metodo_display", read_only=True)

    class Meta:
        model = Pedido
        fields = [
            "id",
            "nombre",
            "municipio",
            "barrio",
            "estado",
            "etapa",
            "total",
            "metodo_pago",
            "creado_en",
        ]
        read_only_fields = fields


class PedidoClienteListaSerializer(serializers.ModelSerializer):
    """Una fila de "Mis pedidos" (FR-12): cuando, cuanto y en que va."""

    etapa_nombre = serializers.CharField(source="get_etapa_display", read_only=True)
    metodo_pago = serializers.CharField(source="pago.get_metodo_display", read_only=True)

    class Meta:
        model = Pedido
        fields = ["id", "creado_en", "total", "etapa", "etapa_nombre", "metodo_pago"]
        read_only_fields = fields